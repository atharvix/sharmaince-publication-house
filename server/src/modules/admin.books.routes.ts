import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { AppError } from '../lib/errors.js';
import { asyncHandler } from '../lib/asyncHandler.js';
import { validate } from '../middleware/validate.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { recordAudit } from '../lib/audit.js';
import { coverImageUpload, detectImageExtension } from '../middleware/upload.js';
import { storage } from '../lib/storage.js';
import { isCoverReadingEnabled, prepareCoverImage, readCoverDetails } from '../lib/coverReader.js';
import { rupeesToMinor } from '../lib/money.js';

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

const slugSchema = z.string().trim().min(1).max(160).regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, 'Lower-case letters, numbers and single hyphens only');

const bookSchema = z.object({
  slug: slugSchema,
  title: z.string().trim().min(1).max(300),
  subtitle: z.string().trim().max(300).optional(),
  categoryId: z.string().min(1),
  authorIds: z.array(z.string().min(1)).min(1).max(20),
  price: z.number().positive().max(1_000_000).nullable().default(null),
  edition: z.string().trim().min(1).max(60).nullable().default(null),
  format: z.enum(['PAPERBACK', 'HARDBOUND', 'EBOOK']),
  // Stored without hyphens or spaces so search and uniqueness don't depend on formatting.
  isbn: z
    .string()
    .transform((v) => v.replace(/[\s-]/g, '').toUpperCase())
    .pipe(z.string().regex(/^(\d{9}[\dX]|\d{13})$/, 'Must be a 10 or 13 digit ISBN'))
    .nullable()
    .default(null),
  pages: z.number().int().positive().max(20_000).nullable().default(null),
  status: z.enum(['DRAFT', 'PUBLISHED', 'ARCHIVED']).default('DRAFT'),
  availability: z.enum(['IN_STOCK', 'PRE_ORDER', 'OUT_OF_STOCK']).default('IN_STOCK'),
  stockQuantity: z.number().int().min(0).default(0),
  description: z.string().trim().min(1).max(10_000),
  highlights: z.array(z.string().trim().min(1).max(300)).max(20).default([]),
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
        priceMinor: price === null ? null : rupeesToMinor(price),
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
        data: { ...rest, ...(price !== undefined ? { priceMinor: price === null ? null : rupeesToMinor(price) } : {}) },
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

// ---------- Home page hero ----------

export const HERO_COLORS = ['blue', 'pink', 'green', 'purple', 'orange'] as const;

const heroSchema = z.object({
  slots: z
    .array(
      z.object({
        bookId: z.string().min(1),
        note: z.string().trim().max(40).nullable().default(null),
        color: z.enum(HERO_COLORS).nullable().default(null),
      }),
    )
    .max(5)
    .refine((slots) => new Set(slots.map((s) => s.bookId)).size === slots.length, 'A book can only appear once'),
});

/** Replaces the whole hero: the books in `slots` take positions 1..n, every other book leaves it. */
adminBooksRouter.put(
  '/hero',
  validate({ body: heroSchema }),
  asyncHandler(async (req, res) => {
    const { slots } = req.body as z.infer<typeof heroSchema>;
    const found = await prisma.book.count({ where: { id: { in: slots.map((s) => s.bookId) }, status: 'PUBLISHED' } });
    if (found !== slots.length) throw AppError.badRequest('Only published books can be shown in the hero');

    await prisma.$transaction([
      prisma.book.updateMany({ where: { heroOrder: { not: null } }, data: { heroOrder: null, heroNote: null, heroColor: null } }),
      ...slots.map((slot, index) =>
        prisma.book.update({ where: { id: slot.bookId }, data: { heroOrder: index + 1, heroNote: slot.note || null, heroColor: slot.color } }),
      ),
    ]);
    await recordAudit({ actorUserId: req.user!.id, action: 'HERO_UPDATED', entityType: 'Book', entityId: 'hero', metadata: { slots } });
    res.json({ slots });
  }),
);

// ---------- Cover image ----------

/**
 * Reads a cover photo for the "add book" form: returns the cleaned-up front cover and,
 * when a Claude API key is configured, the details printed on it. Nothing is saved here;
 * the form uploads the returned cover once the book is created.
 */
adminBooksRouter.post(
  '/read-cover',
  coverImageUpload.single('cover'),
  asyncHandler(async (req, res) => {
    if (!req.file) throw AppError.badRequest('No image file was uploaded (field name must be "cover")');
    detectImageExtension(req.file.buffer);

    const [categories, authors] = await Promise.all([
      prisma.category.findMany({ select: { id: true, slug: true, name: true } }),
      prisma.author.findMany({ select: { id: true, name: true } }),
    ]);
    const details = await readCoverDetails(req.file.buffer, categories);
    const cover = await prepareCoverImage(req.file.buffer, details?.frontCover);

    const normalise = (name: string) => name.toLowerCase().replace(/\b(dr|prof|professor|mr|mrs|ms)\.?\s+/g, '').replace(/[^a-z]/g, '');
    const printedAuthors = (details?.authors ?? []).map((printed) => ({
      ...printed,
      existingId: authors.find((a) => normalise(a.name) === normalise(printed.name))?.id ?? null,
    }));

    res.json({
      cover: `data:image/jpeg;base64,${cover.toString('base64')}`,
      readingEnabled: isCoverReadingEnabled,
      details: details && {
        title: details.title,
        subtitle: details.subtitle,
        slug: slugify(details.title),
        isbn: details.isbn,
        edition: details.edition,
        description: details.description,
        highlights: details.highlights.slice(0, 5),
        categoryId: categories.find((c) => c.slug === details.subjectSlug)?.id ?? null,
        authors: printedAuthors,
      },
    });
  }),
);

adminBooksRouter.post(
  '/:id/cover',
  coverImageUpload.single('cover'),
  asyncHandler(async (req, res) => {
    const existing = await prisma.book.findUnique({ where: { id: req.params.id } });
    if (!existing) throw AppError.notFound('Book not found');
    if (!req.file) throw AppError.badRequest('No image file was uploaded (field name must be "cover")');

    detectImageExtension(req.file.buffer);
    const url = await storage.save(await prepareCoverImage(req.file.buffer), '.jpg', 'covers');

    const book = await prisma.book.update({
      where: { id: req.params.id },
      data: { coverImageUrl: url },
      include: { category: true, authors: { include: { author: true } } },
    });
    // Only drop the old file once the new one is committed.
    if (existing.coverImageUrl) await storage.remove(existing.coverImageUrl);
    await recordAudit({ actorUserId: req.user!.id, action: 'BOOK_COVER_UPDATED', entityType: 'Book', entityId: book.id });
    res.json({ book: serializeAdminBook(book) });
  }),
);

adminBooksRouter.delete(
  '/:id/cover',
  asyncHandler(async (req, res) => {
    const existing = await prisma.book.findUnique({ where: { id: req.params.id } });
    if (!existing) throw AppError.notFound('Book not found');

    const book = await prisma.book.update({
      where: { id: req.params.id },
      data: { coverImageUrl: null },
      include: { category: true, authors: { include: { author: true } } },
    });
    if (existing.coverImageUrl) await storage.remove(existing.coverImageUrl);
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
  validate({ body: z.object({ name: z.string().trim().min(1).max(100), slug: slugSchema }) }),
  asyncHandler(async (req, res) => {
    const category = await prisma.category.create({ data: req.body });
    res.status(201).json({ category });
  }),
);

adminBooksRouter.get(
  '/meta/authors',
  asyncHandler(async (_req, res) => {
    const authors = await prisma.author.findMany({
      include: { books: { include: { book: { select: { slug: true, title: true } } } } },
      orderBy: { name: 'asc' },
    });
    res.json({ items: authors.map(({ books, ...author }) => ({ ...author, books: books.map((b) => b.book) })) });
  }),
);

const authorSchema = z.object({
  slug: slugSchema,
  name: z.string().trim().min(1).max(160),
  credentials: z.string().trim().min(1).max(300),
  bio: z.string().trim().min(1).max(2000),
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
  priceMinor: number | null;
  currency: string;
  edition: string | null;
  format: string;
  isbn: string | null;
  pages: number | null;
  status: string;
  availability: string;
  stockQuantity: number;
  description: string;
  highlights: unknown;
  coverPalette: string;
  coverImageUrl: string | null;
  featured: boolean;
  newRelease: boolean;
  heroOrder: number | null;
  heroNote: string | null;
  heroColor: string | null;
  category: { id: string; name: string; slug: string };
  authors: { author: { id: string; slug: string; name: string } }[];
}) {
  return {
    id: book.id,
    slug: book.slug,
    title: book.title,
    subtitle: book.subtitle,
    price: book.priceMinor === null ? null : book.priceMinor / 100,
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
    heroOrder: book.heroOrder,
    heroNote: book.heroNote,
    heroColor: book.heroColor,
    category: book.category,
    authors: book.authors.map((a) => a.author),
  };
}

function slugify(text: string) {
  return text
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 160);
}
