import type { NextFunction, Request, Response } from 'express';
import type { Role } from '@prisma/client';
import { verifyAccessToken } from '../lib/jwt.js';
import { AppError } from '../lib/errors.js';
import { prisma } from '../lib/prisma.js';

function extractToken(req: Request): string | null {
  const header = req.headers.authorization;
  if (header?.startsWith('Bearer ')) return header.slice('Bearer '.length);
  return null;
}

/**
 * Resolves the access token to a live user. Role and active status are read from the
 * database rather than the token, so deactivating or demoting someone takes effect on
 * their next request instead of when their token expires.
 */
async function resolveUser(token: string) {
  let userId: string;
  try {
    userId = verifyAccessToken(token).sub;
  } catch {
    return null;
  }
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { id: true, role: true, isActive: true } });
  return user?.isActive ? { id: user.id, role: user.role } : null;
}

/** Populates req.user if a valid access token is present; does not reject otherwise. */
export function optionalAuth(req: Request, _res: Response, next: NextFunction) {
  const token = extractToken(req);
  if (!token) return next();

  resolveUser(token)
    .then((user) => {
      if (user) req.user = user;
      next();
    })
    .catch(next);
}

/** Rejects the request unless a valid access token for an active user is present. */
export function requireAuth(req: Request, _res: Response, next: NextFunction) {
  const token = extractToken(req);
  if (!token) return next(AppError.unauthorized());

  resolveUser(token)
    .then((user) => {
      if (!user) return next(AppError.unauthorized('Session expired — please log in again'));
      req.user = user;
      next();
    })
    .catch(next);
}

/** Must run after requireAuth. Rejects unless the user holds one of the given roles. */
export function requireRole(...roles: Role[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) return next(AppError.unauthorized());
    if (!roles.includes(req.user.role)) return next(AppError.forbidden());
    next();
  };
}
