import { describe, expect, it } from 'vitest';
import request from 'supertest';
import { prisma } from '../src/lib/prisma.js';
import { adminLogin, app } from './helpers.js';

describe('home page hero', () => {
  it('replaces the hero with the chosen books, notes and colours, in order', async () => {
    const [first, second] = await prisma.book.findMany({ where: { status: 'PUBLISHED' }, take: 2, orderBy: { slug: 'asc' } });
    const token = await adminLogin();
    const save = (slots: unknown[]) => request(app).put('/api/admin/books/hero').set('Authorization', `Bearer ${token}`).send({ slots });

    try {
      expect((await save([{ bookId: second.id, note: 'Just out', color: 'green' }, { bookId: first.id }])).status).toBe(200);
      const listed = (await request(app).get('/api/catalogue/books')).body.items as { id: string; heroOrder: number | null; heroNote: string | null; heroColor: string | null }[];
      expect(listed.find((b) => b.id === second.id)).toMatchObject({ heroOrder: 1, heroNote: 'Just out', heroColor: 'green' });
      expect(listed.find((b) => b.id === first.id)).toMatchObject({ heroOrder: 2, heroNote: null, heroColor: null });

      // Saving again drops books that aren't in the new list.
      expect((await save([{ bookId: first.id }])).status).toBe(200);
      expect((await prisma.book.findUniqueOrThrow({ where: { id: second.id } })).heroOrder).toBeNull();

      expect((await save([{ bookId: first.id }, { bookId: first.id }])).status).toBe(400);
      expect((await save([{ bookId: first.id, color: 'neon' }])).status).toBe(400);
    } finally {
      await prisma.book.updateMany({ where: { heroOrder: { not: null } }, data: { heroOrder: null, heroNote: null, heroColor: null } });
    }
  });

  it('is staff-only', async () => {
    expect((await request(app).put('/api/admin/books/hero').send({ slots: [] })).status).toBe(401);
  });
});
