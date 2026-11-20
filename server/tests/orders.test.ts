import crypto from 'node:crypto';
import { describe, expect, it } from 'vitest';
import request from 'supertest';
import { prisma } from '../src/lib/prisma.js';
import { expireStaleOrders } from '../src/modules/orders.service.js';
import { adminLogin, app, createOrder, registerCustomer, simulatedVerify, stockedBook } from './helpers.js';

async function stockOf(bookId: string) {
  return (await prisma.book.findUniqueOrThrow({ where: { id: bookId } })).stockQuantity;
}

async function createPromo(data: { discountType: 'PERCENT' | 'FLAT'; discountValue: number; maxRedemptions?: number }) {
  const token = await adminLogin();
  const res = await request(app)
    .post('/api/admin/promotions')
    .set('Authorization', `Bearer ${token}`)
    .send({ code: `T${crypto.randomBytes(4).toString('hex')}`, description: 'test promo', ...data });
  expect(res.status).toBe(201);
  return res.body.promotion as { id: string; code: string; discountValue: number };
}

describe('order lifecycle', () => {
  it('customer cancellation returns stock and the promotion use', async () => {
    const book = await stockedBook();
    const promo = await createPromo({ discountType: 'PERCENT', discountValue: 10, maxRedemptions: 5 });
    const { token } = await registerCustomer();
    const before = await stockOf(book.id);

    const created = await createOrder(token, [{ bookId: book.id, quantity: 2 }], promo.code);
    expect(created.status).toBe(201);
    expect(await stockOf(book.id)).toBe(before - 2);
    expect((await prisma.promotion.findUniqueOrThrow({ where: { id: promo.id } })).redeemedCount).toBe(1);

    const cancel = await request(app).post(`/api/checkout/orders/${created.body.order.id}/cancel`).set('Authorization', `Bearer ${token}`);
    expect(cancel.status).toBe(200);
    expect(await stockOf(book.id)).toBe(before);
    expect((await prisma.promotion.findUniqueOrThrow({ where: { id: promo.id } })).redeemedCount).toBe(0);
  });

  it('staff cancelling an unpaid order also returns its stock', async () => {
    const book = await stockedBook();
    const { token } = await registerCustomer();
    const before = await stockOf(book.id);
    const created = await createOrder(token, [{ bookId: book.id, quantity: 1 }]);

    const res = await request(app)
      .patch(`/api/admin/orders/${created.body.order.id}/status`)
      .set('Authorization', `Bearer ${await adminLogin()}`)
      .send({ status: 'CANCELLED' });
    expect(res.status).toBe(200);
    expect(res.body.order.status).toBe('CANCELLED');
    expect(await stockOf(book.id)).toBe(before);
  });

  it('staff cancelling a paid order refunds the payment and restocks', async () => {
    const book = await stockedBook();
    const { token } = await registerCustomer();
    const before = await stockOf(book.id);
    const created = await createOrder(token, [{ bookId: book.id, quantity: 1 }]);
    await simulatedVerify(token, created.body.order.id, created.body.payment.razorpayOrderId);

    const res = await request(app)
      .patch(`/api/admin/orders/${created.body.order.id}/status`)
      .set('Authorization', `Bearer ${await adminLogin()}`)
      .send({ status: 'CANCELLED', reason: 'customer request' });
    expect(res.status).toBe(200);
    expect(await stockOf(book.id)).toBe(before);
    const payment = await prisma.payment.findFirstOrThrow({ where: { orderId: created.body.order.id } });
    expect(payment.status).toBe('REFUNDED');
  });

  it('refuses status changes the order lifecycle does not allow', async () => {
    const book = await stockedBook();
    const { token } = await registerCustomer();
    const created = await createOrder(token, [{ bookId: book.id, quantity: 1 }]);

    // Payment state comes from the gateway, not from a staff click.
    const res = await request(app)
      .patch(`/api/admin/orders/${created.body.order.id}/status`)
      .set('Authorization', `Bearer ${await adminLogin()}`)
      .send({ status: 'PAID' });
    expect(res.status).toBe(400);
  });

  it('a payment that lands after cancellation is refunded, not accepted', async () => {
    const book = await stockedBook();
    const { token } = await registerCustomer();
    const created = await createOrder(token, [{ bookId: book.id, quantity: 1 }]);
    await request(app).post(`/api/checkout/orders/${created.body.order.id}/cancel`).set('Authorization', `Bearer ${token}`);

    const res = await simulatedVerify(token, created.body.order.id, created.body.payment.razorpayOrderId);
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('ORDER_EXPIRED');

    const order = await prisma.order.findUniqueOrThrow({ where: { id: created.body.order.id }, include: { payments: true } });
    expect(order.status).toBe('CANCELLED');
    expect(order.payments[0].status).toBe('REFUNDED');
  });

  it('verifying the same payment twice marks it paid once', async () => {
    const book = await stockedBook();
    const { token } = await registerCustomer();
    const created = await createOrder(token, [{ bookId: book.id, quantity: 1 }]);
    const args = [token, created.body.order.id, created.body.payment.razorpayOrderId, 'pay_dupe'] as const;

    const [first, second] = await Promise.all([simulatedVerify(...args), simulatedVerify(...args)]);
    expect([first.status, second.status]).toEqual([200, 200]);
    const paidEvents = await prisma.auditEvent.count({ where: { entityId: created.body.order.id, action: 'ORDER_PAID' } });
    expect(paidEvents).toBe(1);
  });

  it('expires unpaid orders past the payment window and releases their stock', async () => {
    // Clear orders left stale by earlier runs first, so only this test's order moves the stock count.
    await expireStaleOrders();
    const book = await stockedBook();
    const { token } = await registerCustomer();
    const before = await stockOf(book.id);
    const created = await createOrder(token, [{ bookId: book.id, quantity: 1 }]);
    await prisma.order.update({ where: { id: created.body.order.id }, data: { createdAt: new Date(Date.now() - 2 * 60 * 60_000) } });

    await expireStaleOrders();

    expect((await prisma.order.findUniqueOrThrow({ where: { id: created.body.order.id } })).status).toBe('CANCELLED');
    expect(await stockOf(book.id)).toBe(before);
  });
});

describe('promotions', () => {
  it('never lets a capped promotion be used more times than allowed, even concurrently', async () => {
    const book = await stockedBook(4);
    const promo = await createPromo({ discountType: 'PERCENT', discountValue: 5, maxRedemptions: 1 });
    const [a, b] = await Promise.all([registerCustomer(), registerCustomer()]);

    const results = await Promise.all([
      createOrder(a.token, [{ bookId: book.id, quantity: 1 }], promo.code),
      createOrder(b.token, [{ bookId: book.id, quantity: 1 }], promo.code),
    ]);
    expect(results.map((r) => r.status).sort()).toEqual([201, expect.any(Number)]);
    expect(results.filter((r) => r.status === 201)).toHaveLength(1);
    expect((await prisma.promotion.findUniqueOrThrow({ where: { id: promo.id } })).redeemedCount).toBe(1);
  });

  it('treats a flat discount entered in rupees as rupees', async () => {
    const book = await stockedBook();
    const promo = await createPromo({ discountType: 'FLAT', discountValue: 100 });
    expect(promo.discountValue).toBe(100);

    const { token } = await registerCustomer();
    const quote = await request(app)
      .post('/api/checkout/quote')
      .set('Authorization', `Bearer ${token}`)
      .send({ items: [{ bookId: book.id, quantity: 1 }], promotionCode: promo.code });
    expect(quote.body.quote.discount).toBe(100);
  });

  it('rejects percentage discounts over 100', async () => {
    const res = await request(app)
      .post('/api/admin/promotions')
      .set('Authorization', `Bearer ${await adminLogin()}`)
      .send({ code: 'TOOMUCH', description: 'x', discountType: 'PERCENT', discountValue: 150 });
    expect(res.status).toBe(400);
  });
});

describe('cart pricing', () => {
  it('counts repeated lines for the same book against stock together', async () => {
    const book = await stockedBook();
    const { token } = await registerCustomer();
    const res = await request(app)
      .post('/api/checkout/quote')
      .set('Authorization', `Bearer ${token}`)
      .send({ items: [{ bookId: book.id, quantity: 15 }, { bookId: book.id, quantity: 15 }] });
    expect(res.status).toBe(400);
  });
});
