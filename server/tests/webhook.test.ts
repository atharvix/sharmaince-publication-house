import crypto from 'node:crypto';
import { describe, expect, it } from 'vitest';
import request from 'supertest';
import { prisma } from '../src/lib/prisma.js';
import { app, createOrder, registerCustomer, stockedBook } from './helpers.js';

const SECRET = 'test-webhook-secret';

function sendWebhook(payload: object, { secret = SECRET, eventId = crypto.randomUUID() } = {}) {
  const body = JSON.stringify(payload);
  const signature = crypto.createHmac('sha256', secret).update(body).digest('hex');
  return request(app)
    .post('/api/payments/webhook')
    .set('Content-Type', 'application/json')
    .set('X-Razorpay-Signature', signature)
    .set('X-Razorpay-Event-Id', eventId)
    .send(body);
}

function captured(razorpayOrderId: string, amount: number) {
  return { event: 'payment.captured', payload: { payment: { entity: { id: `pay_${crypto.randomUUID()}`, order_id: razorpayOrderId, status: 'captured', amount } } } };
}

async function pendingOrder() {
  const book = await stockedBook();
  const { token } = await registerCustomer();
  const res = await createOrder(token, [{ bookId: book.id, quantity: 1 }]);
  return res.body as { order: { id: string; totalMinor: number }; payment: { razorpayOrderId: string } };
}

describe('razorpay webhook', () => {
  it('rejects a payload with a bad signature', async () => {
    const { order, payment } = await pendingOrder();
    const res = await sendWebhook(captured(payment.razorpayOrderId, order.totalMinor), { secret: 'wrong' });
    expect(res.status).toBe(400);
  });

  it('marks the order paid on payment.captured, once', async () => {
    const { order, payment } = await pendingOrder();
    const eventId = crypto.randomUUID();
    const payload = captured(payment.razorpayOrderId, order.totalMinor);

    const first = await sendWebhook(payload, { eventId });
    expect(first.status).toBe(200);
    const replay = await sendWebhook(payload, { eventId });
    expect(replay.body.message).toBe('Already processed');

    const saved = await prisma.order.findUniqueOrThrow({ where: { id: order.id } });
    expect(saved.status).toBe('PAID');
  });

  it('does not mark an order paid when the captured amount is wrong', async () => {
    const { order, payment } = await pendingOrder();
    const res = await sendWebhook(captured(payment.razorpayOrderId, order.totalMinor - 1));
    // Acknowledged so Razorpay stops retrying, but logged and not applied.
    expect(res.status).toBe(200);
    expect((await prisma.order.findUniqueOrThrow({ where: { id: order.id } })).status).toBe('PENDING_PAYMENT');
  });

  it('records payment.failed without touching the order', async () => {
    const { order, payment } = await pendingOrder();
    const res = await sendWebhook({ event: 'payment.failed', payload: { payment: { entity: { id: 'pay_x', order_id: payment.razorpayOrderId, status: 'failed', amount: order.totalMinor } } } });
    expect(res.status).toBe(200);
    expect((await prisma.payment.findUniqueOrThrow({ where: { razorpayOrderId: payment.razorpayOrderId } })).status).toBe('FAILED');
    expect((await prisma.order.findUniqueOrThrow({ where: { id: order.id } })).status).toBe('PENDING_PAYMENT');
  });
});
