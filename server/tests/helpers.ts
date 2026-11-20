import request from 'supertest';
import { createApp } from '../src/app.js';
import { prisma } from '../src/lib/prisma.js';

export const app = createApp();

export function uniqueEmail(prefix = 'test') {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.com`;
}

export async function registerCustomer(email = uniqueEmail()) {
  const res = await request(app).post('/api/auth/register').send({ name: 'Test Customer', email, password: 'Password1' });
  return { token: res.body.accessToken as string, userId: res.body.user.id as string, email, cookie: res.headers['set-cookie'] as unknown as string[] };
}

export async function loginAs(email: string, password: string) {
  const res = await request(app).post('/api/auth/login').send({ email, password });
  return res.body.accessToken as string;
}

export const adminLogin = () => loginAs('admin@nightingalepress.example', 'Admin123!');

export const shippingAddress = {
  label: 'Home',
  fullName: 'Test Customer',
  phone: '9876543210',
  line1: '1 Test Lane',
  city: 'Bengaluru',
  state: 'Karnataka',
  postalCode: '560001',
  country: 'India',
};

export async function stockedBook(minStock = 5) {
  const book = await prisma.book.findFirst({ where: { status: 'PUBLISHED', stockQuantity: { gte: minStock } } });
  if (!book) throw new Error('Seed data required: run `npm run prisma:seed` before tests');
  return book;
}

export function createOrder(token: string, items: { bookId: string; quantity: number }[], promotionCode?: string) {
  return request(app)
    .post('/api/checkout/orders')
    .set('Authorization', `Bearer ${token}`)
    .send({ items, shippingAddress, promotionCode });
}

export function simulatedVerify(token: string, orderId: string, razorpayOrderId: string, razorpayPaymentId = `pay_${Date.now()}`) {
  return request(app)
    .post('/api/checkout/verify')
    .set('Authorization', `Bearer ${token}`)
    .send({ orderId, razorpayOrderId, razorpayPaymentId, razorpaySignature: `simulated.${razorpayOrderId}.${razorpayPaymentId}` });
}
