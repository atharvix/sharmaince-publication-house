import { describe, expect, it, beforeAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { prisma } from '../src/lib/prisma.js';

const app = createApp();

function uniqueEmail() {
  return `checkout-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.com`;
}

async function registerAndGetToken() {
  const email = uniqueEmail();
  const res = await request(app).post('/api/auth/register').send({ name: 'Checkout Tester', email, password: 'Password1' });
  return res.body.accessToken as string;
}

const shippingAddress = {
  label: 'Home',
  fullName: 'Checkout Tester',
  phone: '9876543210',
  line1: '1 Test Lane',
  city: 'Bengaluru',
  state: 'Karnataka',
  postalCode: '560001',
  country: 'India',
};

describe('checkout', () => {
  let bookId: string;

  beforeAll(async () => {
    const book = await prisma.book.findFirst({ where: { status: 'PUBLISHED', stockQuantity: { gt: 1 } } });
    if (!book) throw new Error('Seed data required: run `npm run prisma:seed` before tests');
    bookId = book.id;
  });

  it('rejects checkout without authentication', async () => {
    const res = await request(app).post('/api/checkout/quote').send({ items: [{ bookId, quantity: 1 }] });
    expect(res.status).toBe(401);
  });

  it('prices a cart correctly', async () => {
    const token = await registerAndGetToken();
    const res = await request(app)
      .post('/api/checkout/quote')
      .set('Authorization', `Bearer ${token}`)
      .send({ items: [{ bookId, quantity: 2 }] });

    expect(res.status).toBe(200);
    expect(res.body.quote.lines).toHaveLength(1);
    expect(res.body.quote.lines[0].quantity).toBe(2);
  });

  it('rejects an invalid promotion code', async () => {
    const token = await registerAndGetToken();
    const res = await request(app)
      .post('/api/checkout/quote')
      .set('Authorization', `Bearer ${token}`)
      .send({ items: [{ bookId, quantity: 1 }], promotionCode: 'NOT-REAL' });

    expect(res.status).toBe(400);
  });

  it('creates an order, reserves stock, and completes a simulated payment', async () => {
    const token = await registerAndGetToken();
    const before = await prisma.book.findUniqueOrThrow({ where: { id: bookId } });

    const createRes = await request(app)
      .post('/api/checkout/orders')
      .set('Authorization', `Bearer ${token}`)
      .send({ items: [{ bookId, quantity: 1 }], shippingAddress });

    expect(createRes.status).toBe(201);
    expect(createRes.body.payment.simulated).toBe(true);

    const afterReserve = await prisma.book.findUniqueOrThrow({ where: { id: bookId } });
    expect(afterReserve.stockQuantity).toBe(before.stockQuantity - 1);

    const { order, payment } = createRes.body;
    const razorpayPaymentId = 'pay_test_simulated';
    const verifyRes = await request(app)
      .post('/api/checkout/verify')
      .set('Authorization', `Bearer ${token}`)
      .send({
        orderId: order.id,
        razorpayOrderId: payment.razorpayOrderId,
        razorpayPaymentId,
        razorpaySignature: `simulated.${payment.razorpayOrderId}.${razorpayPaymentId}`,
      });

    expect(verifyRes.status).toBe(200);
    expect(verifyRes.body.order.status).toBe('PAID');
  });

  it('rejects a forged payment signature', async () => {
    const token = await registerAndGetToken();
    const createRes = await request(app)
      .post('/api/checkout/orders')
      .set('Authorization', `Bearer ${token}`)
      .send({ items: [{ bookId, quantity: 1 }], shippingAddress });

    const { order, payment } = createRes.body;
    const verifyRes = await request(app)
      .post('/api/checkout/verify')
      .set('Authorization', `Bearer ${token}`)
      .send({
        orderId: order.id,
        razorpayOrderId: payment.razorpayOrderId,
        razorpayPaymentId: 'pay_forged',
        razorpaySignature: 'not-the-right-signature',
      });

    expect(verifyRes.status).toBe(400);
  });

  it('prevents one customer from viewing another customer\'s order', async () => {
    const tokenA = await registerAndGetToken();
    const tokenB = await registerAndGetToken();

    const createRes = await request(app)
      .post('/api/checkout/orders')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ items: [{ bookId, quantity: 1 }], shippingAddress });

    const res = await request(app)
      .get(`/api/me/orders/${createRes.body.order.id}`)
      .set('Authorization', `Bearer ${tokenB}`);

    expect(res.status).toBe(404);
  });
});

describe('books announced before they are priced', () => {
  it('are listed with no price but cannot be quoted or bought', async () => {
    const template = await prisma.book.findFirstOrThrow({ where: { status: 'PUBLISHED' }, include: { authors: true } });
    const book = await prisma.book.create({
      data: {
        slug: `unpriced-${Date.now()}`,
        title: 'Announced Title',
        categoryId: template.categoryId,
        format: 'PAPERBACK',
        status: 'PUBLISHED',
        // No stock, so tests that grab any stocked book never pick this one.
        stockQuantity: 0,
        description: 'Coming soon.',
        highlights: [],
        authors: { create: [{ authorId: template.authors[0].authorId }] },
      },
    });

    try {
      const listed = await request(app).get(`/api/catalogue/books/${book.slug}`);
      expect(listed.status).toBe(200);
      expect(listed.body.book).toMatchObject({ price: null, isbn: null, pages: null, edition: null });

      const quote = await request(app)
        .post('/api/checkout/quote')
        .set('Authorization', `Bearer ${await registerAndGetToken()}`)
        .send({ items: [{ bookId: book.id, quantity: 1 }] });
      expect(quote.status).toBe(400);
      expect(quote.body.error.message).toMatch(/isn't on sale yet/);
    } finally {
      await prisma.book.delete({ where: { id: book.id } });
    }
  });
});
