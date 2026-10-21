import { Router } from 'express';
import { z } from 'zod';
import type { OrderStatus } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { AppError } from '../lib/errors.js';
import { asyncHandler } from '../lib/asyncHandler.js';
import { validate } from '../middleware/validate.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { recordAudit } from '../lib/audit.js';

export const adminOrdersRouter = Router();
adminOrdersRouter.use(requireAuth, requireRole('STAFF', 'ADMIN'));

const ALLOWED_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  PENDING_PAYMENT: ['PAID', 'CANCELLED'],
  PAID: ['PROCESSING', 'CANCELLED', 'REFUNDED'],
  PROCESSING: ['SHIPPED', 'CANCELLED', 'REFUNDED'],
  SHIPPED: ['DELIVERED', 'REFUNDED'],
  DELIVERED: ['REFUNDED'],
  CANCELLED: [],
  REFUNDED: [],
};

const listQuerySchema = z.object({
  query: z.object({
    status: z.enum(['PENDING_PAYMENT', 'PAID', 'PROCESSING', 'SHIPPED', 'DELIVERED', 'CANCELLED', 'REFUNDED']).optional(),
    q: z.string().optional(),
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(25),
  }),
});

adminOrdersRouter.get(
  '/',
  validate({ query: listQuerySchema.shape.query }),
  asyncHandler(async (req, res) => {
    const { status, q, page, pageSize } = req.query as unknown as z.infer<typeof listQuerySchema>['query'];
    const where = {
      ...(status ? { status } : {}),
      ...(q
        ? {
            OR: [
              { orderNumber: { contains: q, mode: 'insensitive' as const } },
              { user: { email: { contains: q, mode: 'insensitive' as const } } },
            ],
          }
        : {}),
    };

    const [total, orders] = await Promise.all([
      prisma.order.count({ where }),
      prisma.order.findMany({
        where,
        include: { user: { select: { name: true, email: true } }, items: true },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);

    res.json({ items: orders, page, pageSize, total, totalPages: Math.ceil(total / pageSize) });
  }),
);

adminOrdersRouter.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const order = await prisma.order.findUnique({
      where: { id: req.params.id },
      include: { user: { select: { name: true, email: true } }, items: true, payments: true },
    });
    if (!order) throw AppError.notFound('Order not found');
    res.json({ order });
  }),
);

const statusSchema = z.object({
  body: z.object({
    status: z.enum(['PENDING_PAYMENT', 'PAID', 'PROCESSING', 'SHIPPED', 'DELIVERED', 'CANCELLED', 'REFUNDED']),
    reason: z.string().max(500).optional(),
  }),
});

adminOrdersRouter.patch(
  '/:id/status',
  validate({ body: statusSchema.shape.body }),
  asyncHandler(async (req, res) => {
    const order = await prisma.order.findUnique({ where: { id: req.params.id }, include: { items: true } });
    if (!order) throw AppError.notFound('Order not found');

    const { status, reason } = req.body;
    if (!ALLOWED_TRANSITIONS[order.status].includes(status)) {
      throw AppError.badRequest(`Cannot move an order from ${order.status} to ${status}`);
    }

    await prisma.$transaction(async (tx) => {
      if ((status === 'CANCELLED' || status === 'REFUNDED') && order.status !== 'PENDING_PAYMENT') {
        // Restore stock for orders that were paid/processing before being cancelled or refunded.
        for (const item of order.items) {
          await tx.book.update({ where: { id: item.bookId }, data: { stockQuantity: { increment: item.quantity } } });
        }
      }

      const now = new Date();
      await tx.order.update({
        where: { id: order.id },
        data: {
          status,
          shippedAt: status === 'SHIPPED' ? now : undefined,
          deliveredAt: status === 'DELIVERED' ? now : undefined,
          cancelledAt: status === 'CANCELLED' ? now : undefined,
        },
      });
    });

    await recordAudit({
      actorUserId: req.user!.id,
      action: 'ORDER_STATUS_CHANGED',
      entityType: 'Order',
      entityId: order.id,
      metadata: { from: order.status, to: status, reason },
    });

    const updated = await prisma.order.findUnique({ where: { id: order.id }, include: { items: true } });
    res.json({ order: updated });
  }),
);

const trackingSchema = z.object({
  body: z.object({
    trackingCarrier: z.string().min(1).max(100),
    trackingNumber: z.string().min(1).max(100),
    trackingUrl: z.string().url().optional(),
  }),
});

adminOrdersRouter.patch(
  '/:id/tracking',
  validate({ body: trackingSchema.shape.body }),
  asyncHandler(async (req, res) => {
    const order = await prisma.order.update({ where: { id: req.params.id }, data: req.body });
    await recordAudit({ actorUserId: req.user!.id, action: 'ORDER_TRACKING_UPDATED', entityType: 'Order', entityId: order.id, metadata: req.body });
    res.json({ order });
  }),
);
