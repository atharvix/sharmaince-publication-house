import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { AppError } from '../lib/errors.js';
import { asyncHandler } from '../lib/asyncHandler.js';
import { validate } from '../middleware/validate.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { recordAudit } from '../lib/audit.js';
import { coverImageUpload, extensionForMime } from '../middleware/upload.js';
import { storage } from '../lib/storage.js';

export const adminBooksRouter = Router();
adminBooksRouter.use(requireAuth, requireRole('STAFF', 'ADMIN'));

adminBooksRouter.get(
  '/',
  asyncHandler(async (_req, res) => {
    const books = await prisma.book.findMany({
      include: { category: true, authors: { include: { author: true } } },
      orderBy: { updatedAt: 'desc' },
    });
    res.json({ items: books.map(serializeAdminBook) });
  }),
);

const bookSchema = z.object({
  slug: z.string().min(1).max(160),
  title: z.string().min(1).max(300),
  subtitle: z.string().max(300).optional(),
  categoryId: z.string().min(1),
  authorIds: z.array(z.string().min(1)).min(1),
  price: z.number().positive(),
  edition: z.string().min(1).max(60),
  format: z.enum(['PAPERBACK', 'HARDBOUND', 'EBOOK']),
  isbn: z.string().min(1).max(32),
  pages: z.number().int().positive(),
  status: z.enum(['DRAFT', 'PUBLISHED', 'ARCHIVED']).default('DRAFT'),
  availability: z.enum(['IN_STOCK', 'PRE_ORDER', 'OUT_OF_STOCK']).default('IN_STOCK'),
  stockQuantity: z.number().int().min(0).default(0),
  description: z.string().min(1),
  highlights: z.array(z.string()).default([]),
  coverPalette: z.enum(['pine', 'amber', 'clay', 'slate']).default('pine'),
  featured: z.boolean().default(false),
  newRelease: z.boolean().default(false),
});

adminBooksRouter.post(
  '/',
  validate({ body: bookSchema }),
  asyncHandler(async (req, res) => {
    const { authorIds, price, ...rest } = req.body;
    const book = await prisma.book.create({
      data: {
        ...rest,
        priceMinor: Math.round(price * 100),
        authors: { create: authorIds.map((authorId: string) => ({ authorId })) },
      },
      include: { category: true, authors: { include: { author: true } } },
    });
    await recordAudit({ actorUserId: req.user!.id, action: 'BOOK_CREATED', entityType: 'Book', entityId: book.id });
    res.status(201).json({ book: serializeAdminBook(book) });
  }),
);

adminBooksRouter.patch(
  '/:id',
  validate({ body: bookSchema.partial() }),
  asyncHandler(async (req, res) => {
    const existing = await prisma.book.findUnique({ where: { id: req.params.id } });
    if (!existing) throw AppError.notFound('Book not found');

    const { authorIds, price, ...rest } = req.body;

    const book = await prisma.$transaction(async (tx) => {
      if (authorIds) {
        await tx.bookAuthor.deleteMany({ where: { bookId: req.params.id } });
        await tx.bookAuthor.createMany({ data: authorIds.map((authorId: string) => ({ bookId: req.params.id, authorId })) });
      }
      return tx.book.update({
        where: { id: req.params.id },
        data: { ...rest, ...(price !== undefined ? { priceMinor: Math.round(price * 100) } : {}) },
        include: { category: true, authors: { include: { author: true } } },
      });
    });

    await recordAudit({ actorUserId: req.user!.id, action: 'BOOK_UPDATED', entityType: 'Book', entityId: book.id, metadata: req.body });
    res.json({ book: serializeAdminBook(book) });
  }),
);

adminBooksRouter.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    const existing = await prisma.book.findUnique({ where: { id: req.params.id } });
    if (!existing) throw AppError.notFound('Book not found');

    // Archive rather than hard-delete so historical order line-item references remain valid.
    const book = await prisma.book.update({ where: { id: req.params.id }, data: { status: 'ARCHIVED' } });
    await recordAudit({ actorUserId: req.user!.id, action: 'BOOK_ARCHIVED', entityType: 'Book', entityId: book.id });
    res.status(204).send();
  }),
);

// ---------- Cover image ----------

adminBooksRouter.post(
  '/:id/cover',
  coverImageUpload.single('cover'),
  asyncHandler(async (req, res) => {
    const existing = await prisma.book.findUnique({ where: { id: req.params.id } });
    if (!existing) throw AppError.notFound('Book not found');
    if (!req.file) throw AppError.badRequest('No image file was uploaded (field name must be "cover")');

    const url = await storage.save(req.file.buffer, extensionForMime(req.file.mimetype), 'covers');

    if (existing.coverImageUrl) await storage.remove(existing.coverImageUrl);

    const book = await prisma.book.update({
      where: { id: req.params.id },
      data: { coverImageUrl: url },
      include: { category: true, authors: { include: { author: true } } },
    });
    await recordAudit({ actorUserId: req.user!.id, action: 'BOOK_COVER_UPDATED', entityType: 'Book', entityId: book.id });
    res.json({ book: serializeAdminBook(book) });
  }),
);

adminBooksRouter.delete(
  '/:id/cover',
  asyncHandler(async (req, res) => {
    const existing = await prisma.book.findUnique({ where: { id: req.params.id } });
    if (!existing) throw AppError.notFound('Book not found');

    if (existing.coverImageUrl) await storage.remove(existing.coverImageUrl);

    const book = await prisma.book.update({
      where: { id: req.params.id },
      data: { coverImageUrl: null },
      include: { category: true, authors: { include: { author: true } } },
    });
    await recordAudit({ actorUserId: req.user!.id, action: 'BOOK_COVER_REMOVED', entityType: 'Book', entityId: book.id });
    res.json({ book: serializeAdminBook(book) });
  }),
);

// ---------- Supporting lookups: categories & authors ----------

adminBooksRouter.get(
  '/meta/categories',
  asyncHandler(async (_req, res) => {
    res.json({ items: await prisma.category.findMany({ orderBy: { name: 'asc' } }) });
  }),
);

adminBooksRouter.post(
  '/meta/categories',
  validate({ body: z.object({ name: z.string().min(1).max(100), slug: z.string().min(1).max(120) }) }),
  asyncHandler(async (req, res) => {
    const category = await prisma.category.create({ data: req.body });
    res.status(201).json({ category });
  }),
);

adminBooksRouter.get(
  '/meta/authors',
  asyncHandler(async (_req, res) => {
    res.json({ items: await prisma.author.findMany({ orderBy: { name: 'asc' } }) });
  }),
);

const authorSchema = z.object({
  slug: z.string().min(1).max(160),
  name: z.string().min(1).max(160),
  credentials: z.string().min(1).max(300),
  bio: z.string().min(1).max(2000),
});

adminBooksRouter.post(
  '/meta/authors',
  validate({ body: authorSchema }),
  asyncHandler(async (req, res) => {
    const author = await prisma.author.create({ data: req.body });
    res.status(201).json({ author });
  }),
);

adminBooksRouter.patch(
  '/meta/authors/:id',
  validate({ body: authorSchema.partial() }),
  asyncHandler(async (req, res) => {
    const author = await prisma.author.update({ where: { id: req.params.id }, data: req.body });
    res.json({ author });
  }),
);

function serializeAdminBook(book: {
  id: string;
  slug: string;
  title: string;
  subtitle: string | null;
  priceMinor: number;
  currency: string;
  edition: string;
  format: string;
  isbn: string;
  pages: number;
  status: string;
  availability: string;
  stockQuantity: number;
  description: string;
  highlights: unknown;
  coverPalette: string;
  coverImageUrl: string | null;
  featured: boolean;
  newRelease: boolean;
  category: { id: string; name: string; slug: string };
  authors: { author: { id: string; slug: string; name: string } }[];
}) {
  return {
    id: book.id,
    slug: book.slug,
    title: book.title,
    subtitle: book.subtitle,
    price: book.priceMinor / 100,
    currency: book.currency,
    edition: book.edition,
    format: book.format,
    isbn: book.isbn,
    pages: book.pages,
    status: book.status,
    availability: book.availability,
    stockQuantity: book.stockQuantity,
    inStock: book.stockQuantity > 0,
    description: book.description,
    highlights: book.highlights,
    coverPalette: book.coverPalette,
    coverImageUrl: book.coverImageUrl,
    featured: book.featured,
    newRelease: book.newRelease,
    category: book.category,
    authors: book.authors.map((a) => a.author),
  };
}
