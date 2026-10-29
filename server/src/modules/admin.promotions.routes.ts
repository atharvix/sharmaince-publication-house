import { Router } from 'express';
import { z } from 'zod';
import type { Promotion } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { AppError } from '../lib/errors.js';
import { asyncHandler } from '../lib/asyncHandler.js';
import { validate } from '../middleware/validate.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { recordAudit } from '../lib/audit.js';
import { minorToRupees, rupeesToMinor } from '../lib/money.js';

export const adminPromotionsRouter = Router();
// Discount codes affect revenue directly — admin-only.
adminPromotionsRouter.use(requireAuth, requireRole('ADMIN'));

/**
 * The API speaks rupees for money (`discountValue` when FLAT, `minSpend`) and whole
 * percent when PERCENT; the database stores paise.
 */
function serializePromotion(promotion: Promotion) {
  const { minSpendMinor, ...rest } = promotion;
  return {
    ...rest,
    discountValue: promotion.discountType === 'FLAT' ? minorToRupees(promotion.discountValue) : promotion.discountValue,
    minSpend: minSpendMinor === null ? null : minorToRupees(minSpendMinor),
  };
}

const promotionFields = {
  code: z.string().trim().min(2).max(40).regex(/^[A-Za-z0-9_-]+$/, 'Letters, numbers, - and _ only').transform((v) => v.toUpperCase()),
  description: z.string().trim().min(1).max(300),
  discountType: z.enum(['PERCENT', 'FLAT']),
  discountValue: z.number().positive(),
  minSpend: z.number().nonnegative().nullable().optional(),
  maxRedemptions: z.number().int().positive().nullable().optional(),
  startsAt: z.string().datetime().nullable().optional(),
  endsAt: z.string().datetime().nullable().optional(),
  isActive: z.boolean(),
};

function checkPromotion(value: { discountType?: string; discountValue?: number; startsAt?: string | null; endsAt?: string | null }, ctx: z.RefinementCtx) {
  if (value.discountType === 'PERCENT' && value.discountValue !== undefined && (value.discountValue > 100 || !Number.isInteger(value.discountValue))) {
    ctx.addIssue({ code: 'custom', path: ['discountValue'], message: 'Percent discounts must be a whole number from 1 to 100' });
  }
  if (value.startsAt && value.endsAt && new Date(value.startsAt) >= new Date(value.endsAt)) {
    ctx.addIssue({ code: 'custom', path: ['endsAt'], message: 'Must be after the start date' });
  }
}

const createBody = z.object({ ...promotionFields, isActive: promotionFields.isActive.default(true) }).superRefine(checkPromotion);
const updateBody = z.object(promotionFields).partial().superRefine(checkPromotion);

function storedDiscountValue(value: number, discountType: Promotion['discountType']) {
  return discountType === 'FLAT' ? rupeesToMinor(value) : value;
}

function toData(body: z.infer<typeof updateBody>, discountType: Promotion['discountType']) {
  const { discountValue, minSpend, startsAt, endsAt, ...rest } = body;
  return {
    ...rest,
    ...(discountValue !== undefined ? { discountValue: storedDiscountValue(discountValue, discountType) } : {}),
    ...(minSpend !== undefined ? { minSpendMinor: minSpend === null ? null : rupeesToMinor(minSpend) } : {}),
    ...(startsAt !== undefined ? { startsAt: startsAt === null ? null : new Date(startsAt) } : {}),
    ...(endsAt !== undefined ? { endsAt: endsAt === null ? null : new Date(endsAt) } : {}),
  };
}

adminPromotionsRouter.get(
  '/',
  asyncHandler(async (_req, res) => {
    const promotions = await prisma.promotion.findMany({ orderBy: { createdAt: 'desc' } });
    res.json({ items: promotions.map(serializePromotion) });
  }),
);

adminPromotionsRouter.post(
  '/',
  validate({ body: createBody }),
  asyncHandler(async (req, res) => {
    const body = req.body as z.infer<typeof createBody>;
    const { code, description, discountType, discountValue, isActive } = body;
    const promotion = await prisma.promotion.create({
      data: { ...toData(body, discountType), code, description, discountType, discountValue: storedDiscountValue(discountValue, discountType), isActive },
    });
    await recordAudit({ actorUserId: req.user!.id, action: 'PROMOTION_CREATED', entityType: 'Promotion', entityId: promotion.id });
    res.status(201).json({ promotion: serializePromotion(promotion) });
  }),
);

adminPromotionsRouter.patch(
  '/:id',
  validate({ body: updateBody }),
  asyncHandler(async (req, res) => {
    const body = req.body as z.infer<typeof updateBody>;
    const existing = await prisma.promotion.findUnique({ where: { id: req.params.id } });
    if (!existing) throw AppError.notFound('Promotion not found');

    const discountType = body.discountType ?? existing.discountType;
    if (body.discountType && body.discountType !== existing.discountType && body.discountValue === undefined) {
      throw AppError.badRequest('Changing the discount type requires a new discount value');
    }
    if (discountType === 'PERCENT' && body.discountValue !== undefined && (body.discountValue > 100 || !Number.isInteger(body.discountValue))) {
      throw AppError.badRequest('Percent discounts must be a whole number from 1 to 100');
    }

    const promotion = await prisma.promotion.update({ where: { id: existing.id }, data: toData(body, discountType) });
    await recordAudit({ actorUserId: req.user!.id, action: 'PROMOTION_UPDATED', entityType: 'Promotion', entityId: promotion.id, metadata: body });
    res.json({ promotion: serializePromotion(promotion) });
  }),
);

// Promotions are referenced by past orders, so "delete" deactivates.
adminPromotionsRouter.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    const promotion = await prisma.promotion.update({ where: { id: req.params.id }, data: { isActive: false } });
    await recordAudit({ actorUserId: req.user!.id, action: 'PROMOTION_DEACTIVATED', entityType: 'Promotion', entityId: promotion.id });
    res.status(204).send();
  }),
);
