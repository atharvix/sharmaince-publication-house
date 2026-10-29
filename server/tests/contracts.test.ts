import { describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';

const app = createApp();

describe('API contract basics', () => {
  it('GET /api/health reports liveness and echoes a request id', async () => {
    const res = await request(app).get('/api/health').set('X-Request-Id', 'probe-123');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
    expect(res.headers['x-request-id']).toBe('probe-123');
  });

  it('GET /api/ready reports database readiness', async () => {
    const res = await request(app).get('/api/ready');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ready');
  });

  it('unknown routes return a structured 404', async () => {
    const res = await request(app).get('/api/this-route-does-not-exist');
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });

  it('malformed JSON bodies return a structured 400, not a 500', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .set('Content-Type', 'application/json')
      .send('{not valid json');
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('BAD_REQUEST');
  });

  it('refresh with no cookie returns 401 and does not throw', async () => {
    const res = await request(app).post('/api/auth/refresh');
    expect(res.status).toBe(401);
    expect(res.body.error).toBeDefined();
  });

  it('catalogue list returns an empty, valid page for a query matching nothing', async () => {
    const res = await request(app).get('/api/catalogue/books').query({ q: 'no-such-title-xyz-123' });
    expect(res.status).toBe(200);
    expect(res.body.items).toEqual([]);
    expect(res.body.total).toBe(0);
  });

  it('rejects an invalid book format filter instead of silently ignoring it', async () => {
    const res = await request(app).get('/api/catalogue/books').query({ format: 'NOT_A_FORMAT' });
    expect(res.status).toBe(400);
  });

  it('rejects an unreasonable pageSize instead of silently clamping or crashing', async () => {
    const res = await request(app).get('/api/catalogue/books').query({ pageSize: '100000' });
    expect(res.status).toBe(400);
  });
});
