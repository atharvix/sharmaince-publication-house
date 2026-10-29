import { Router, type Response } from 'express';
import crypto from 'node:crypto';
import { z } from 'zod';
import type { User } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { AppError } from '../lib/errors.js';
import { asyncHandler } from '../lib/asyncHandler.js';
import { hashPassword, verifyPassword, passwordSchema } from '../lib/password.js';
import { signAccessToken, signRefreshToken, verifyRefreshToken } from '../lib/jwt.js';
import { sendEmail, passwordResetEmail } from '../lib/email.js';
import { logger } from '../lib/logger.js';
import { emailSchema } from '../lib/validation.js';
import { validate } from '../middleware/validate.js';
import { requireAuth } from '../middleware/auth.js';
import { authRateLimiter } from '../middleware/rateLimit.js';
import { env, durationToMs, isProduction } from '../env.js';

export const authRouter = Router();

const REFRESH_COOKIE = 'refresh_token';
const REFRESH_TTL_MS = durationToMs(env.JWT_REFRESH_TTL);
const REFRESH_COOKIE_OPTIONS = {
  httpOnly: true,
  sameSite: 'lax' as const,
  secure: isProduction,
  path: '/api/auth',
};
// A rotated refresh token presented again within this window is treated as a benign
// race (two tabs, React StrictMode double effects) rather than token theft.
const ROTATION_GRACE_MS = 30_000;
const PASSWORD_RESET_TTL_MS = 60 * 60 * 1000;

function publicUser(user: Pick<User, 'id' | 'email' | 'name' | 'role'>) {
  return { id: user.id, email: user.email, name: user.name, role: user.role };
}

function hashToken(token: string) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

async function issueTokens(res: Response, user: Pick<User, 'id'>, familyId: string = crypto.randomUUID()) {
  const session = await prisma.refreshSession.create({
    data: { userId: user.id, familyId, expiresAt: new Date(Date.now() + REFRESH_TTL_MS) },
  });
  res.cookie(REFRESH_COOKIE, signRefreshToken({ sub: user.id, sid: session.id }), {
    ...REFRESH_COOKIE_OPTIONS,
    maxAge: REFRESH_TTL_MS,
  });
  return signAccessToken({ sub: user.id });
}

/** Revokes every refresh session for a user — used on password change/reset and deactivation. */
export function revokeAllSessions(userId: string) {
  return prisma.refreshSession.updateMany({ where: { userId, revokedAt: null }, data: { revokedAt: new Date() } });
}

const registerBody = z.object({
  name: z.string().trim().min(2).max(120),
  email: emailSchema,
  password: passwordSchema,
});

authRouter.post(
  '/register',
  authRateLimiter,
  validate({ body: registerBody }),
  asyncHandler(async (req, res) => {
    const { name, email, password } = req.body as z.infer<typeof registerBody>;

    const existing = await prisma.user.findUnique({ where: { email }, select: { id: true } });
    if (existing) throw AppError.conflict('An account with this email already exists');

    const user = await prisma.user.create({ data: { name, email, passwordHash: await hashPassword(password) } });
    const accessToken = await issueTokens(res, user);
    res.status(201).json({ user: publicUser(user), accessToken });
  }),
);

const loginBody = z.object({ email: emailSchema, password: z.string().min(1).max(200) });

// Compared against when the email is unknown so response time doesn't reveal which emails exist.
const DUMMY_PASSWORD_HASH = hashPassword(crypto.randomBytes(16).toString('hex'));

authRouter.post(
  '/login',
  authRateLimiter,
  validate({ body: loginBody }),
  asyncHandler(async (req, res) => {
    const { email, password } = req.body as z.infer<typeof loginBody>;
    const user = await prisma.user.findUnique({ where: { email } });

    const passwordOk = await verifyPassword(password, user?.passwordHash ?? (await DUMMY_PASSWORD_HASH));
    if (!user || !passwordOk) {
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
    const token: unknown = req.cookies?.[REFRESH_COOKIE];
    if (typeof token !== 'string') throw AppError.unauthorized();

    const expired = () => {
      res.clearCookie(REFRESH_COOKIE, REFRESH_COOKIE_OPTIONS);
      return AppError.unauthorized('Session expired — please log in again');
    };

    let sessionId: string;
    try {
      sessionId = verifyRefreshToken(token).sid;
    } catch {
      throw expired();
    }

    const session = await prisma.refreshSession.findUnique({ where: { id: sessionId }, include: { user: true } });
    if (!session || session.revokedAt || session.expiresAt < new Date() || !session.user.isActive) {
      throw expired();
    }

    // Claim the session atomically so two concurrent refreshes can't both rotate it.
    const claimed = await prisma.refreshSession.updateMany({
      where: { id: session.id, rotatedAt: null },
      data: { rotatedAt: new Date() },
    });

    if (claimed.count === 0) {
      const rotatedAt = session.rotatedAt ?? new Date();
      if (Date.now() - rotatedAt.getTime() > ROTATION_GRACE_MS) {
        // An old token is being replayed: assume it leaked and kill the whole family.
        await prisma.refreshSession.updateMany({
          where: { familyId: session.familyId, revokedAt: null },
          data: { revokedAt: new Date() },
        });
        logger.warn({ userId: session.userId, familyId: session.familyId }, 'refresh token reuse detected; family revoked');
        throw expired();
      }
    }

    const accessToken = await issueTokens(res, session.user, session.familyId);
    res.json({ user: publicUser(session.user), accessToken });
  }),
);

authRouter.post(
  '/logout',
  asyncHandler(async (req, res) => {
    const token: unknown = req.cookies?.[REFRESH_COOKIE];
    if (typeof token === 'string') {
      try {
        const { sid } = verifyRefreshToken(token);
        const session = await prisma.refreshSession.findUnique({ where: { id: sid }, select: { familyId: true } });
        if (session) {
          await prisma.refreshSession.updateMany({
            where: { familyId: session.familyId, revokedAt: null },
            data: { revokedAt: new Date() },
          });
        }
      } catch {
        // An invalid or expired cookie has nothing left to revoke.
      }
    }
    res.clearCookie(REFRESH_COOKIE, REFRESH_COOKIE_OPTIONS);
    res.status(204).send();
  }),
);

authRouter.get(
  '/me',
  requireAuth,
  asyncHandler(async (req, res) => {
    const user = await prisma.user.findUniqueOrThrow({ where: { id: req.user!.id } });
    res.json({ user: publicUser(user) });
  }),
);

const forgotPasswordBody = z.object({ email: emailSchema });

authRouter.post(
  '/forgot-password',
  authRateLimiter,
  validate({ body: forgotPasswordBody }),
  asyncHandler(async (req, res) => {
    const { email } = req.body as z.infer<typeof forgotPasswordBody>;
    const user = await prisma.user.findUnique({ where: { email } });

    if (user?.isActive) {
      const token = crypto.randomBytes(32).toString('hex');
      await prisma.user.update({
        where: { id: user.id },
        data: { passwordResetTokenHash: hashToken(token), passwordResetExpires: new Date(Date.now() + PASSWORD_RESET_TTL_MS) },
      });

      const resetUrl = `${env.PUBLIC_WEB_URL}/reset-password?token=${token}`;
      // Not awaited: a slow or failing mail provider must not change the response, or the
      // timing/status would reveal which emails are registered.
      sendEmail({ to: user.email, ...passwordResetEmail(resetUrl) }).catch((error: unknown) =>
        logger.error({ err: error, userId: user.id }, 'failed to send password reset email'),
      );
    }

    res.status(202).json({ message: 'If that email is registered, a reset link has been sent.' });
  }),
);

const resetPasswordBody = z.object({ token: z.string().min(1).max(200), password: passwordSchema });

authRouter.post(
  '/reset-password',
  authRateLimiter,
  validate({ body: resetPasswordBody }),
  asyncHandler(async (req, res) => {
    const { token, password } = req.body as z.infer<typeof resetPasswordBody>;
    const user = await prisma.user.findUnique({ where: { passwordResetTokenHash: hashToken(token) } });

    if (!user || !user.passwordResetExpires || user.passwordResetExpires < new Date()) {
      throw AppError.badRequest('This reset link is invalid or has expired');
    }

    await prisma.$transaction([
      prisma.user.update({
        where: { id: user.id },
        data: { passwordHash: await hashPassword(password), passwordResetTokenHash: null, passwordResetExpires: null },
      }),
      prisma.refreshSession.updateMany({ where: { userId: user.id, revokedAt: null }, data: { revokedAt: new Date() } }),
    ]);

    res.json({ message: 'Password updated — please log in with your new password.' });
  }),
);
