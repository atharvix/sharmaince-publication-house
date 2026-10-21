import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { AppError } from '../lib/errors.js';
import { asyncHandler } from '../lib/asyncHandler.js';
import { validate } from '../middleware/validate.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { recordAudit } from '../lib/audit.js';

export const adminPromotionsRouter = Router();
// Discount codes affect revenue directly — admin-only.
adminPromotionsRouter.use(requireAuth, requireRole('ADMIN'));

adminPromotionsRouter.get(
  '/',
  asyncHandler(async (_req, res) => {
    res.json({ items: await prisma.promotion.findMany({ orderBy: { createdAt: 'desc' } }) });
  }),
);

const promotionSchema = z.object({
  code: z.string().min(2).max(40).transform((v) => v.toUpperCase()),
  description: z.string().min(1).max(300),
  discountType: z.enum(['PERCENT', 'FLAT']),
  discountValue: z.number().int().positive(),
  minSpend: z.number().nonnegative().optional(),
  maxRedemptions: z.number().int().positive().optional(),
  startsAt: z.string().datetime().optional(),
  endsAt: z.string().datetime().optional(),
  isActive: z.boolean().default(true),
});

adminPromotionsRouter.post(
  '/',
  validate({ body: promotionSchema }),
  asyncHandler(async (req, res) => {
    const { minSpend, startsAt, endsAt, ...rest } = req.body;
    const promotion = await prisma.promotion.create({
      data: {
        ...rest,
        minSpendMinor: minSpend !== undefined ? Math.round(minSpend * 100) : undefined,
        startsAt: startsAt ? new Date(startsAt) : undefined,
        endsAt: endsAt ? new Date(endsAt) : undefined,
      },
    });
    await recordAudit({ actorUserId: req.user!.id, action: 'PROMOTION_CREATED', entityType: 'Promotion', entityId: promotion.id });
    res.status(201).json({ promotion });
  }),
);

adminPromotionsRouter.patch(
  '/:id',
  validate({ body: promotionSchema.partial() }),
  asyncHandler(async (req, res) => {
    const existing = await prisma.promotion.findUnique({ where: { id: req.params.id } });
    if (!existing) throw AppError.notFound('Promotion not found');

    const { minSpend, startsAt, endsAt, ...rest } = req.body;
    const promotion = await prisma.promotion.update({
      where: { id: req.params.id },
      data: {
        ...rest,
        ...(minSpend !== undefined ? { minSpendMinor: Math.round(minSpend * 100) } : {}),
        ...(startsAt !== undefined ? { startsAt: new Date(startsAt) } : {}),
        ...(endsAt !== undefined ? { endsAt: new Date(endsAt) } : {}),
      },
    });
    await recordAudit({ actorUserId: req.user!.id, action: 'PROMOTION_UPDATED', entityType: 'Promotion', entityId: promotion.id });
    res.json({ promotion });
  }),
);

adminPromotionsRouter.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    await prisma.promotion.update({ where: { id: req.params.id }, data: { isActive: false } });
    res.status(204).send();
  }),
);
