import crypto from 'node:crypto';
import { describe, expect, it } from 'vitest';
import request from 'supertest';
import sharp from 'sharp';
import { prisma } from '../src/lib/prisma.js';
import { adminLogin, app, registerCustomer, uniqueEmail } from './helpers.js';

function refreshWith(cookie: string[]) {
  return request(app).post('/api/auth/refresh').set('Cookie', cookie);
}

describe('sessions', () => {
  it('rotates the refresh token and tolerates a near-simultaneous second use', async () => {
    const { cookie } = await registerCustomer();
    const first = await refreshWith(cookie);
    expect(first.status).toBe(200);
    expect(first.headers['set-cookie']).toBeDefined();

    // e.g. two tabs refreshing at once: inside the grace window, so not treated as theft.
    expect((await refreshWith(cookie)).status).toBe(200);
  });

  it('revokes the whole session family when an old refresh token is replayed', async () => {
    const { cookie, userId } = await registerCustomer();
    const rotated = await refreshWith(cookie);
    const newCookie = rotated.headers['set-cookie'] as unknown as string[];

    await prisma.refreshSession.updateMany({ where: { userId, rotatedAt: { not: null } }, data: { rotatedAt: new Date(Date.now() - 60_000) } });

    expect((await refreshWith(cookie)).status).toBe(401);
    // The legitimate newer token dies too — the attacker and the user both have to sign in again.
    expect((await refreshWith(newCookie)).status).toBe(401);
  });

  it('logout ends the session server-side', async () => {
    const { cookie } = await registerCustomer();
    await request(app).post('/api/auth/logout').set('Cookie', cookie);
    expect((await refreshWith(cookie)).status).toBe(401);
  });

  it('a deactivated user is locked out immediately, not when their token expires', async () => {
    const { token, userId, cookie } = await registerCustomer();
    const res = await request(app)
      .patch(`/api/admin/users/${userId}`)
      .set('Authorization', `Bearer ${await adminLogin()}`)
      .send({ isActive: false });
    expect(res.status).toBe(200);

    expect((await request(app).get('/api/auth/me').set('Authorization', `Bearer ${token}`)).status).toBe(401);
    expect((await refreshWith(cookie)).status).toBe(401);
  });

  it('treats email addresses case-insensitively', async () => {
    const email = uniqueEmail('Case');
    await request(app).post('/api/auth/register').send({ name: 'Case Test', email: email.toUpperCase(), password: 'Password1' });
    const login = await request(app).post('/api/auth/login').send({ email: email.toLowerCase(), password: 'Password1' });
    expect(login.status).toBe(200);

    const dupe = await request(app).post('/api/auth/register').send({ name: 'Case Test', email: email.toLowerCase(), password: 'Password1' });
    expect(dupe.status).toBe(409);
  });

  it('stores only a hash of the password reset token, and the token works once', async () => {
    const { email, userId } = await registerCustomer();
    await request(app).post('/api/auth/forgot-password').send({ email });

    const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
    expect(user.passwordResetTokenHash).toMatch(/^[a-f0-9]{64}$/);

    // We can't read the emailed token back, so plant a known one the same way the route does.
    const token = crypto.randomBytes(32).toString('hex');
    await prisma.user.update({
      where: { id: userId },
      data: { passwordResetTokenHash: crypto.createHash('sha256').update(token).digest('hex') },
    });

    const reset = await request(app).post('/api/auth/reset-password').send({ token, password: 'NewPassword2' });
    expect(reset.status).toBe(200);
    const again = await request(app).post('/api/auth/reset-password').send({ token, password: 'NewPassword3' });
    expect(again.status).toBe(400);
  });
});

describe('cover uploads', () => {
  it('rejects a non-image even when it claims to be a PNG', async () => {
    const book = await prisma.book.findFirstOrThrow();
    const res = await request(app)
      .post(`/api/admin/books/${book.id}/cover`)
      .set('Authorization', `Bearer ${await adminLogin()}`)
      .attach('cover', Buffer.from('<script>alert(1)</script>'), { filename: 'cover.png', contentType: 'image/png' });
    expect(res.status).toBe(415);
  });

  it('crops a wraparound cover photo down to its front panel', async () => {
    const wraparound = await sharp({ create: { width: 1536, height: 1024, channels: 3, background: '#1d3b8f' } }).jpeg().toBuffer();
    const res = await request(app)
      .post('/api/admin/books/read-cover')
      .set('Authorization', `Bearer ${await adminLogin()}`)
      .attach('cover', wraparound, { filename: 'wrap.jpg', contentType: 'image/jpeg' });
    expect(res.status).toBe(200);

    const cover = await sharp(Buffer.from(res.body.cover.split(',')[1], 'base64')).metadata();
    expect(cover.format).toBe('jpeg');
    expect(cover.width! / cover.height!).toBeCloseTo(0.7, 1);
  });
});
