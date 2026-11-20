import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { AppError } from '../lib/errors.js';
import { asyncHandler } from '../lib/asyncHandler.js';
import { validate } from '../middleware/validate.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { recordAudit } from '../lib/audit.js';
import { pageMeta, paginate, paginationQuery } from '../lib/validation.js';
import { changeOrderStatusAsStaff } from './orders.service.js';

export const adminOrdersRouter = Router();
adminOrdersRouter.use(requireAuth, requireRole('STAFF', 'ADMIN'));

const ORDER_STATUSES = ['PENDING_PAYMENT', 'PAID', 'PROCESSING', 'SHIPPED', 'DELIVERED', 'CANCELLED', 'REFUNDED'] as const;

const listQuery = z.object({
  status: z.enum(ORDER_STATUSES).optional(),
  q: z.string().trim().max(200).optional(),
  ...paginationQuery(),
});

adminOrdersRouter.get(
  '/',
  validate({ query: listQuery }),
  asyncHandler(async (req, res) => {
    const { status, q, page, pageSize } = req.query as unknown as z.infer<typeof listQuery>;
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
        ...paginate(page, pageSize),
      }),
    ]);

    res.json({ items: orders, ...pageMeta(page, pageSize, total) });
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

const statusBody = z.object({ status: z.enum(ORDER_STATUSES), reason: z.string().trim().max(500).optional() });

adminOrdersRouter.patch(
  '/:id/status',
  validate({ body: statusBody }),
  asyncHandler(async (req, res) => {
    const { status, reason } = req.body as z.infer<typeof statusBody>;
    await changeOrderStatusAsStaff(req.params.id, status, req.user!.id, reason);
    const order = await prisma.order.findUniqueOrThrow({ where: { id: req.params.id }, include: { items: true } });
    res.json({ order });
  }),
);

const trackingBody = z.object({
  trackingCarrier: z.string().trim().min(1).max(100),
  trackingNumber: z.string().trim().min(1).max(100),
  // Rendered as a link to customers, so only web URLs.
  trackingUrl: z.string().url().regex(/^https?:\/\//, 'Must be an http(s) link').optional(),
});

adminOrdersRouter.patch(
  '/:id/tracking',
  validate({ body: trackingBody }),
  asyncHandler(async (req, res) => {
    const order = await prisma.order.update({ where: { id: req.params.id }, data: req.body });
    await recordAudit({ actorUserId: req.user!.id, action: 'ORDER_TRACKING_UPDATED', entityType: 'Order', entityId: order.id, metadata: req.body });
    res.json({ order });
  }),
);
