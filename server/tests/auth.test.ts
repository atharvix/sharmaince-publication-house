import { describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';

const app = createApp();

function uniqueEmail() {
  return `test-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.com`;
}

describe('auth', () => {
  it('registers a new user and returns an access token', async () => {
    const email = uniqueEmail();
    const res = await request(app)
      .post('/api/auth/register')
      .send({ name: 'Test User', email, password: 'Password1' });

    expect(res.status).toBe(201);
    expect(res.body.user.email).toBe(email);
    expect(typeof res.body.accessToken).toBe('string');
  });

  it('rejects registration with a weak password', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ name: 'Test User', email: uniqueEmail(), password: 'weak' });

    expect(res.status).toBe(400);
  });

  it('rejects login with the wrong password', async () => {
    const email = uniqueEmail();
    await request(app).post('/api/auth/register').send({ name: 'Test User', email, password: 'Password1' });

    const res = await request(app).post('/api/auth/login').send({ email, password: 'WrongPassword1' });
    expect(res.status).toBe(401);
  });

  it('rejects /me without a token', async () => {
    const res = await request(app).get('/api/auth/me');
    expect(res.status).toBe(401);
  });

  it('prevents a second account from registering with the same email', async () => {
    const email = uniqueEmail();
    await request(app).post('/api/auth/register').send({ name: 'First', email, password: 'Password1' });
    const res = await request(app).post('/api/auth/register').send({ name: 'Second', email, password: 'Password1' });
    expect(res.status).toBe(409);
  });
});
