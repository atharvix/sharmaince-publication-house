import { Router } from 'express';
import { z } from 'zod';
import type { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { AppError } from '../lib/errors.js';
import { asyncHandler } from '../lib/asyncHandler.js';
import { validate } from '../middleware/validate.js';

export const catalogueRouter = Router();

const listQuerySchema = z.object({
  query: z.object({
    q: z.string().trim().optional(),
    category: z.string().optional(),
    format: z.enum(['PAPERBACK', 'HARDBOUND', 'EBOOK']).optional(),
    sort: z.enum(['relevance', 'price-asc', 'price-desc', 'title-asc']).default('relevance'),
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(48).default(24),
  }),
});

catalogueRouter.get(
  '/books',
  validate({ query: listQuerySchema.shape.query }),
  asyncHandler(async (req, res) => {
    const { q, category, format, sort, page, pageSize } = req.query as unknown as z.infer<typeof listQuerySchema>['query'];

    const where: Prisma.BookWhereInput = {
      status: 'PUBLISHED',
      ...(category ? { category: { slug: category } } : {}),
      ...(format ? { format } : {}),
      ...(q
        ? {
            OR: [
              { title: { contains: q, mode: 'insensitive' } },
              { isbn: { contains: q.replace(/-/g, '') } },
              { authors: { some: { author: { name: { contains: q, mode: 'insensitive' } } } } },
            ],
          }
        : {}),
    };

    const orderBy =
      sort === 'price-asc'
        ? { priceMinor: { sort: 'asc' as const, nulls: 'last' as const } }
        : sort === 'price-desc'
          ? { priceMinor: { sort: 'desc' as const, nulls: 'last' as const } }
          : sort === 'title-asc'
            ? { title: 'asc' as const }
            : { featured: 'desc' as const };

    const [total, books] = await Promise.all([
      prisma.book.count({ where }),
      prisma.book.findMany({
        where,
        orderBy,
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: { category: true, authors: { include: { author: true } } },
      }),
    ]);

    res.json({
      items: books.map(serializeBook),
      page,
      pageSize,
      total,
      totalPages: Math.ceil(total / pageSize),
    });
  }),
);

catalogueRouter.get(
  '/books/:slug',
  asyncHandler(async (req, res) => {
    const book = await prisma.book.findUnique({
      where: { slug: req.params.slug },
      include: { category: true, authors: { include: { author: true } } },
    });

    if (!book || book.status !== 'PUBLISHED') throw AppError.notFound('Book not found');

    const related = await prisma.book.findMany({
      where: { categoryId: book.categoryId, status: 'PUBLISHED', NOT: { id: book.id } },
      take: 3,
      include: { category: true, authors: { include: { author: true } } },
    });

    res.json({ book: serializeBook(book), related: related.map(serializeBook) });
  }),
);

catalogueRouter.get(
  '/categories',
  asyncHandler(async (_req, res) => {
    const categories = await prisma.category.findMany({
      include: { _count: { select: { books: { where: { status: 'PUBLISHED' } } } } },
      orderBy: { name: 'asc' },
    });
    res.json({
      items: categories.map((c) => ({ id: c.id, name: c.name, slug: c.slug, bookCount: c._count.books })),
    });
  }),
);

catalogueRouter.get(
  '/authors',
  asyncHandler(async (_req, res) => {
    const authors = await prisma.author.findMany({
      include: { books: { include: { book: true } } },
      orderBy: { name: 'asc' },
    });
    res.json({ items: authors.map(serializeAuthor) });
  }),
);

catalogueRouter.get(
  '/authors/:slug',
  asyncHandler(async (req, res) => {
    const author = await prisma.author.findUnique({
      where: { slug: req.params.slug },
      include: { books: { include: { book: true } } },
    });
    if (!author) throw AppError.notFound('Author not found');
    res.json({ author: serializeAuthor(author) });
  }),
);

function serializeBook(book: {
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
  availability: string;
  stockQuantity: number;
  description: string;
  highlights: unknown;
  coverPalette: string;
  coverImageUrl: string | null;
  featured: boolean;
  newRelease: boolean;
  category: { name: string; slug: string };
  authors: { author: { slug: string; name: string } }[];
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
    availability: book.availability,
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

function serializeAuthor(author: {
  slug: string;
  name: string;
  credentials: string;
  bio: string;
  books: { book: { slug: string; title: string; status: string } }[];
}) {
  return {
    slug: author.slug,
    name: author.name,
    credentials: author.credentials,
    bio: author.bio,
    books: author.books
      .filter((b) => b.book.status === 'PUBLISHED')
      .map((b) => ({ slug: b.book.slug, title: b.book.title })),
  };
}
