import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { AppError } from '../lib/errors.js';
import { asyncHandler } from '../lib/asyncHandler.js';
import { validate } from '../middleware/validate.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { recordAudit } from '../lib/audit.js';
import { publicFormRateLimiter } from '../middleware/rateLimit.js';

export const bulkOrdersRouter = Router();

const createSchema = z.object({
  body: z.object({
    organizationName: z.string().min(1).max(200),
    organizationType: z.string().min(1).max(60),
    contactName: z.string().min(1).max(120),
    email: z.string().email(),
    phone: z.string().min(6).max(20),
    deliveryLocation: z.string().min(1).max(200),
    titlesOfInterest: z.string().max(1000).optional(),
    notes: z.string().max(2000).optional(),
  }),
});

bulkOrdersRouter.post(
  '/',
  publicFormRateLimiter,
  validate({ body: createSchema.shape.body }),
  asyncHandler(async (req, res) => {
    const request = await prisma.bulkOrderRequest.create({ data: req.body });
    res.status(201).json({ request: { id: request.id, status: request.status } });
  }),
);

// ---------- Staff management ----------

bulkOrdersRouter.use('/admin', requireAuth, requireRole('STAFF', 'ADMIN'));

bulkOrdersRouter.get(
  '/admin',
  asyncHandler(async (_req, res) => {
    const items = await prisma.bulkOrderRequest.findMany({
      include: { assignedTo: { select: { id: true, name: true } } },
      orderBy: { createdAt: 'desc' },
    });
    res.json({ items });
  }),
);

const updateSchema = z.object({
  body: z.object({
    status: z.enum(['SUBMITTED', 'ASSIGNED', 'QUOTE_IN_PROGRESS', 'QUOTE_SENT', 'ACCEPTED', 'DECLINED', 'FULFILLED', 'CLOSED']).optional(),
    assignedToUserId: z.string().optional(),
  }),
});

bulkOrdersRouter.patch(
  '/admin/:id',
  validate({ body: updateSchema.shape.body }),
  asyncHandler(async (req, res) => {
    const existing = await prisma.bulkOrderRequest.findUnique({ where: { id: req.params.id } });
    if (!existing) throw AppError.notFound('Bulk order request not found');

    const request = await prisma.bulkOrderRequest.update({ where: { id: req.params.id }, data: req.body });
    await recordAudit({
      actorUserId: req.user!.id,
      action: 'BULK_ORDER_UPDATED',
      entityType: 'BulkOrderRequest',
      entityId: request.id,
      metadata: req.body,
    });
    res.json({ request });
  }),
);
