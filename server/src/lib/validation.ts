import { z } from 'zod';

/** Emails are compared case-insensitively, so they are stored lower-cased. */
export const emailSchema = z.string().trim().toLowerCase().email().max(254);

/** Optional `?page=&pageSize=` for list endpoints. */
export function paginationQuery(defaultPageSize = 25, maxPageSize = 100) {
  return {
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(maxPageSize).default(defaultPageSize),
  };
}

export function paginate(page: number, pageSize: number) {
  return { skip: (page - 1) * pageSize, take: pageSize };
}

export function pageMeta(page: number, pageSize: number, total: number) {
  return { page, pageSize, total, totalPages: Math.ceil(total / pageSize) };
}
