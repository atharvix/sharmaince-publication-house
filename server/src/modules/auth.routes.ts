import { Router } from 'express';
import crypto from 'node:crypto';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { AppError } from '../lib/errors.js';
import { asyncHandler } from '../lib/asyncHandler.js';
import { hashPassword, isStrongPassword, verifyPassword } from '../lib/password.js';
import { signAccessToken, signRefreshToken, verifyRefreshToken } from '../lib/jwt.js';
import { sendEmail, passwordResetEmail } from '../lib/email.js';
import { validate } from '../middleware/validate.js';
import { requireAuth } from '../middleware/auth.js';
import { authRateLimiter } from '../middleware/rateLimit.js';
import { env } from '../env.js';

export const authRouter = Router();

const REFRESH_COOKIE = 'refresh_token';
const REFRESH_COOKIE_OPTIONS = {
  httpOnly: true,
  sameSite: 'lax' as const,
  secure: env.NODE_ENV === 'production',
  path: '/api/auth',
  maxAge: 30 * 24 * 60 * 60 * 1000,
};

function publicUser(user: { id: string; email: string; name: string; role: string }) {
  return { id: user.id, email: user.email, name: user.name, role: user.role };
}

async function issueTokens(res: import('express').Response, user: { id: string; role: 'CUSTOMER' | 'STAFF' | 'ADMIN'; refreshTokenVersion: number }) {
  const accessToken = signAccessToken({ sub: user.id, role: user.role });
  const refreshToken = signRefreshToken({ sub: user.id, ver: user.refreshTokenVersion });
  res.cookie(REFRESH_COOKIE, refreshToken, REFRESH_COOKIE_OPTIONS);
  return accessToken;
}

const registerSchema = z.object({
  body: z.object({
    name: z.string().min(2).max(120),
    email: z.string().email(),
    password: z.string().min(8).refine(isStrongPassword, {
      message: 'Password must include an uppercase letter, a lowercase letter and a number',
    }),
  }),
});

authRouter.post(
  '/register',
  authRateLimiter,
  validate({ body: registerSchema.shape.body }),
  asyncHandler(async (req, res) => {
    const { name, email, password } = req.body;

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) throw AppError.conflict('An account with this email already exists');

    const user = await prisma.user.create({
      data: { name, email, passwordHash: await hashPassword(password) },
    });

    const accessToken = await issueTokens(res, user);
    res.status(201).json({ user: publicUser(user), accessToken });
  }),
);

const loginSchema = z.object({
  body: z.object({
    email: z.string().email(),
    password: z.string().min(1),
  }),
});

authRouter.post(
  '/login',
  authRateLimiter,
  validate({ body: loginSchema.shape.body }),
  asyncHandler(async (req, res) => {
    const { email, password } = req.body;
    const user = await prisma.user.findUnique({ where: { email } });

    if (!user || !(await verifyPassword(password, user.passwordHash))) {
      throw new AppError(401, 'INVALID_CREDENTIALS', 'Incorrect email or password');
    }
    if (!user.isActive) throw AppError.forbidden('This account has been deactivated');

    const accessToken = await issueTokens(res, user);
    res.json({ user: publicUser(user), accessToken });
  }),
);

authRouter.post(
  '/refresh',
  authRateLimiter,
  asyncHandler(async (req, res) => {
    const token = req.cookies?.[REFRESH_COOKIE];
    if (!token) throw AppError.unauthorized();

    let payload;
    try {
      payload = verifyRefreshToken(token);
    } catch {
      throw AppError.unauthorized('Session expired — please log in again');
    }

    const user = await prisma.user.findUnique({ where: { id: payload.sub } });
    if (!user || !user.isActive || user.refreshTokenVersion !== payload.ver) {
      throw AppError.unauthorized('Session expired — please log in again');
    }

    const accessToken = await issueTokens(res, user);
    res.json({ user: publicUser(user), accessToken });
  }),
);

authRouter.post('/logout', (_req, res) => {
  res.clearCookie(REFRESH_COOKIE, { path: '/api/auth' });
  res.status(204).send();
});

authRouter.get(
  '/me',
  requireAuth,
  asyncHandler(async (req, res) => {
    const user = await prisma.user.findUnique({ where: { id: req.user!.id } });
    if (!user) throw AppError.notFound();
    res.json({ user: publicUser(user) });
  }),
);

const forgotPasswordSchema = z.object({ body: z.object({ email: z.string().email() }) });

authRouter.post(
  '/forgot-password',
  authRateLimiter,
  validate({ body: forgotPasswordSchema.shape.body }),
  asyncHandler(async (req, res) => {
    const { email } = req.body;
    const user = await prisma.user.findUnique({ where: { email } });

    // Always respond 202 regardless of whether the account exists, to avoid leaking which emails are registered.
    if (user) {
      const token = crypto.randomBytes(32).toString('hex');
      await prisma.user.update({
        where: { id: user.id },
        data: { passwordResetToken: token, passwordResetExpires: new Date(Date.now() + 60 * 60 * 1000) },
      });

      const resetUrl = `${env.PUBLIC_WEB_URL}/reset-password?token=${token}`;
      const { subject, html, text } = passwordResetEmail(resetUrl);
      await sendEmail({ to: user.email, subject, html, text });
    }

    res.status(202).json({ message: 'If that email is registered, a reset link has been sent.' });
  }),
);

const resetPasswordSchema = z.object({
  body: z.object({
    token: z.string().min(1),
    password: z.string().min(8).refine(isStrongPassword, {
      message: 'Password must include an uppercase letter, a lowercase letter and a number',
    }),
  }),
});

authRouter.post(
  '/reset-password',
  authRateLimiter,
  validate({ body: resetPasswordSchema.shape.body }),
  asyncHandler(async (req, res) => {
    const { token, password } = req.body;
    const user = await prisma.user.findUnique({ where: { passwordResetToken: token } });

    if (!user || !user.passwordResetExpires || user.passwordResetExpires < new Date()) {
      throw AppError.badRequest('This reset link is invalid or has expired');
    }

    await prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash: await hashPassword(password),
        passwordResetToken: null,
        passwordResetExpires: null,
        refreshTokenVersion: { increment: 1 },
      },
    });

    res.json({ message: 'Password updated — please log in with your new password.' });
  }),
);
