import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { asyncHandler } from '../lib/asyncHandler.js';
import { validate } from '../middleware/validate.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { publicFormRateLimiter } from '../middleware/rateLimit.js';

export const contactRouter = Router();

const createSchema = z.object({
  body: z.object({
    name: z.string().min(1).max(120),
    email: z.string().email(),
    reason: z.string().min(1).max(80),
    message: z.string().min(1).max(4000),
  }),
});

contactRouter.post(
  '/',
  publicFormRateLimiter,
  validate({ body: createSchema.shape.body }),
  asyncHandler(async (req, res) => {
    await prisma.contactMessage.create({ data: req.body });
    res.status(202).json({ message: 'Thank you — we will respond within one business day.' });
  }),
);

contactRouter.get(
  '/admin',
  requireAuth,
  requireRole('STAFF', 'ADMIN'),
  asyncHandler(async (_req, res) => {
    const items = await prisma.contactMessage.findMany({ orderBy: { createdAt: 'desc' } });
    res.json({ items });
  }),
);
