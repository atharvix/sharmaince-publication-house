import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { asyncHandler } from '../lib/asyncHandler.js';
import { validate } from '../middleware/validate.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { publicFormRateLimiter } from '../middleware/rateLimit.js';
import { emailSchema, pageMeta, paginate, paginationQuery } from '../lib/validation.js';

export const contactRouter = Router();

const createSchema = z.object({
  body: z.object({
    name: z.string().min(1).max(120),
    email: emailSchema,
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

const adminListQuery = z.object(paginationQuery(50));

contactRouter.get(
  '/admin',
  requireAuth,
  requireRole('STAFF', 'ADMIN'),
  validate({ query: adminListQuery }),
  asyncHandler(async (req, res) => {
    const { page, pageSize } = req.query as unknown as z.infer<typeof adminListQuery>;
    const [total, items] = await Promise.all([
      prisma.contactMessage.count(),
      prisma.contactMessage.findMany({ orderBy: { createdAt: 'desc' }, ...paginate(page, pageSize) }),
    ]);
    res.json({ items, ...pageMeta(page, pageSize, total) });
  }),
);
