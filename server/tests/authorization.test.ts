import { describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';

const app = createApp();

function uniqueEmail() {
  return `authz-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.com`;
}

async function registerCustomer() {
  const email = uniqueEmail();
  const res = await request(app).post('/api/auth/register').send({ name: 'Plain Customer', email, password: 'Password1' });
  return res.body.accessToken as string;
}

async function loginAs(email: string, password: string) {
  const res = await request(app).post('/api/auth/login').send({ email, password });
  return res.body.accessToken as string;
}

describe('role-based authorization boundaries', () => {
  it('blocks a customer from the admin books list', async () => {
    const token = await registerCustomer();
    const res = await request(app).get('/api/admin/books').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(403);
  });

  it('blocks a customer from the admin dashboard', async () => {
    const token = await registerCustomer();
    const res = await request(app).get('/api/admin/reports/dashboard').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(403);
  });

  it('blocks a customer from changing another user\'s role', async () => {
    const token = await registerCustomer();
    const res = await request(app).patch('/api/admin/users/anything').set('Authorization', `Bearer ${token}`).send({ role: 'ADMIN' });
    expect(res.status).toBe(403);
  });

  it('allows admin login to reach the admin dashboard', async () => {
    const login = await request(app).post('/api/auth/login').send({ email: 'admin@nightingalepress.example', password: 'Admin123!' });
    expect(login.status).toBe(200);
    const res = await request(app).get('/api/admin/reports/dashboard').set('Authorization', `Bearer ${login.body.accessToken}`);
    expect(res.status).toBe(200);
  });

  it('rejects an unauthenticated request to a protected account route', async () => {
    const res = await request(app).get('/api/me/orders');
    expect(res.status).toBe(401);
  });
});

describe('staff vs admin permission boundaries', () => {
  it('blocks staff from the users admin panel entirely', async () => {
    const token = await loginAs('staff@nightingalepress.example', 'Staff123!');
    const res = await request(app).get('/api/admin/users').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(403);
  });

  it('blocks staff from promotions (create and list)', async () => {
    const token = await loginAs('staff@nightingalepress.example', 'Staff123!');
    const list = await request(app).get('/api/admin/promotions').set('Authorization', `Bearer ${token}`);
    expect(list.status).toBe(403);

    const create = await request(app)
      .post('/api/admin/promotions')
      .set('Authorization', `Bearer ${token}`)
      .send({ code: 'STAFFTRY', description: 'x', discountType: 'PERCENT', discountValue: 10 });
    expect(create.status).toBe(403);
  });

  it('blocks staff from the detailed sales report but allows the shared dashboard', async () => {
    const token = await loginAs('staff@nightingalepress.example', 'Staff123!');
    const sales = await request(app).get('/api/admin/reports/sales').set('Authorization', `Bearer ${token}`);
    expect(sales.status).toBe(403);

    const dashboard = await request(app).get('/api/admin/reports/dashboard').set('Authorization', `Bearer ${token}`);
    expect(dashboard.status).toBe(200);
    expect(dashboard.body.totalRevenue).toBeNull();
    expect(dashboard.body.newUsersCount).toBeNull();
  });

  it('gives admin full revenue figures on the same dashboard endpoint', async () => {
    const token = await loginAs('admin@nightingalepress.example', 'Admin123!');
    const res = await request(app).get('/api/admin/reports/dashboard').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(typeof res.body.totalRevenue).toBe('number');
    expect(typeof res.body.newUsersCount).toBe('number');
  });

  it('allows staff to manage the book catalogue', async () => {
    const token = await loginAs('staff@nightingalepress.example', 'Staff123!');
    const res = await request(app).get('/api/admin/books').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
  });
});

describe('book cover uploads', () => {
  // A minimal valid 1x1 PNG.
  const PNG_BYTES = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
    'base64',
  );

  async function getAnyBookId() {
    const token = await loginAs('admin@nightingalepress.example', 'Admin123!');
    const res = await request(app).get('/api/admin/books').set('Authorization', `Bearer ${token}`);
    return { bookId: res.body.items[0].id as string, token };
  }

  it('rejects an unauthenticated cover upload', async () => {
    const { bookId } = await getAnyBookId();
    const res = await request(app).post(`/api/admin/books/${bookId}/cover`).attach('cover', PNG_BYTES, 'cover.png');
    expect(res.status).toBe(401);
  });

  it('rejects a cover upload from a customer', async () => {
    const { bookId } = await getAnyBookId();
    const customerToken = await registerCustomer();
    const res = await request(app)
      .post(`/api/admin/books/${bookId}/cover`)
      .set('Authorization', `Bearer ${customerToken}`)
      .attach('cover', PNG_BYTES, 'cover.png');
    expect(res.status).toBe(403);
  });

  it('rejects a non-image file', async () => {
    const { bookId, token } = await getAnyBookId();
    const res = await request(app)
      .post(`/api/admin/books/${bookId}/cover`)
      .set('Authorization', `Bearer ${token}`)
      .attach('cover', Buffer.from('not an image'), { filename: 'notes.txt', contentType: 'text/plain' });
    expect(res.status).toBe(415);
  });

  it('accepts a valid PNG, serves it back, then removes it', async () => {
    const { bookId, token } = await getAnyBookId();

    const upload = await request(app)
      .post(`/api/admin/books/${bookId}/cover`)
      .set('Authorization', `Bearer ${token}`)
      .attach('cover', PNG_BYTES, 'cover.png');
    expect(upload.status).toBe(200);
    expect(upload.body.book.coverImageUrl).toMatch(/^\/uploads\/covers\/.+\.jpg$/);

    const fetched = await request(app).get(upload.body.book.coverImageUrl);
    expect(fetched.status).toBe(200);
    expect(fetched.headers['content-type']).toContain('image/jpeg');

    const removed = await request(app).delete(`/api/admin/books/${bookId}/cover`).set('Authorization', `Bearer ${token}`);
    expect(removed.status).toBe(200);
    expect(removed.body.book.coverImageUrl).toBeNull();
  });
});
