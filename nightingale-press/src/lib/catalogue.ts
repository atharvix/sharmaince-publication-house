import { api, ApiError } from './api';
import type { Book, Author, Category, Faq } from '../types';
import type { ApiAuthor, ApiBook, ApiCategory } from '../types/api';

const AVAILABILITY_LABEL: Record<ApiBook['availability'], Book['availability']> = {
  IN_STOCK: 'In Stock',
  PRE_ORDER: 'Pre-Order',
  OUT_OF_STOCK: 'Out of Stock',
};

const FORMAT_LABEL: Record<ApiBook['format'], Book['format']> = {
  PAPERBACK: 'Paperback',
  HARDBOUND: 'Hardbound',
  EBOOK: 'E-Book',
};

/** "A", "A & B", "A, B & C" */
export function joinNames(names: string[]) {
  return names.length <= 2 ? names.join(' & ') : `${names.slice(0, -1).join(', ')} & ${names[names.length - 1]}`;
}

export function mapApiBook(book: ApiBook): Book {
  return {
    id: book.id,
    slug: book.slug,
    title: book.title,
    subtitle: book.subtitle ?? undefined,
    author: joinNames(book.authors.map((a) => a.name)),
    category: { name: book.category.name, slug: book.category.slug },
    price: book.price,
    edition: book.edition,
    format: FORMAT_LABEL[book.format],
    isbn: book.isbn,
    pages: book.pages,
    availability: AVAILABILITY_LABEL[book.availability],
    description: book.description,
    highlights: book.highlights,
    coverPalette: book.coverPalette,
    coverImageUrl: book.coverImageUrl,
    featured: book.featured,
    newRelease: book.newRelease,
    heroOrder: book.heroOrder,
    heroNote: book.heroNote,
    heroColor: book.heroColor,
  };
}

function mapApiAuthor(author: ApiAuthor): Author {
  return { slug: author.slug, name: author.name, credentials: author.credentials, bio: author.bio, books: author.books };
}

function mapApiCategory(category: ApiCategory): Category {
  return { name: category.name, slug: category.slug, bookCount: category.bookCount };
}

export interface BookListParams {
  q?: string;
  category?: string;
  format?: 'PAPERBACK' | 'HARDBOUND' | 'EBOOK';
  sort?: 'relevance' | 'price-asc' | 'price-desc' | 'title-asc';
  page?: number;
  pageSize?: number;
}

export interface BookListResult {
  items: Book[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export async function fetchBooks(params: BookListParams = {}): Promise<BookListResult> {
  const query = new URLSearchParams();
  if (params.q) query.set('q', params.q);
  if (params.category) query.set('category', params.category);
  if (params.format) query.set('format', params.format);
  if (params.sort) query.set('sort', params.sort);
  if (params.page) query.set('page', String(params.page));
  if (params.pageSize) query.set('pageSize', String(params.pageSize));

  const qs = query.toString();
  const res = await api.get<{ items: ApiBook[]; page: number; pageSize: number; total: number; totalPages: number }>(
    `/catalogue/books${qs ? `?${qs}` : ''}`,
  );
  return { ...res, items: res.items.map(mapApiBook) };
}

export async function fetchBookBySlug(slug: string): Promise<{ book: Book; related: Book[] }> {
  const res = await api.get<{ book: ApiBook; related: ApiBook[] }>(`/catalogue/books/${slug}`);
  return { book: mapApiBook(res.book), related: res.related.map(mapApiBook) };
}

export async function fetchCategories(): Promise<Category[]> {
  const res = await api.get<{ items: ApiCategory[] }>('/catalogue/categories');
  return res.items.map(mapApiCategory);
}

export async function fetchAuthors(): Promise<Author[]> {
  const res = await api.get<{ items: ApiAuthor[] }>('/catalogue/authors');
  return res.items.map(mapApiAuthor);
}

export async function fetchFaqs(): Promise<Faq[]> {
  const res = await api.get<{ items: { topic: string; question: string; answer: string }[] }>('/content/faqs');
  return res.items;
}

export interface CmsPage {
  slug: string;
  title: string;
  intro: string | null;
  sections: { heading: string; body: string }[];
  updatedAt: string;
}

/**
 * Loads CMS-managed copy for a static page. Returns `null` (never throws) when the page
 * has no CMS content yet or has been unpublished, so callers can safely fall back to the
 * page's own built-in default copy instead of showing an error for normal draft state.
 */
export async function fetchContentPage(slug: string): Promise<CmsPage | null> {
  try {
    const res = await api.get<{ page: CmsPage }>(`/content/pages/${slug}`);
    return res.page;
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) return null;
    throw err;
  }
}
