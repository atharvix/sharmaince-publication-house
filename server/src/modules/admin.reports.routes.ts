import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { asyncHandler } from '../lib/asyncHandler.js';
import { validate } from '../middleware/validate.js';
import { requireAuth, requireRole } from '../middleware/auth.js';

export const adminReportsRouter = Router();
adminReportsRouter.use(requireAuth, requireRole('STAFF', 'ADMIN'));

const PAID_STATUSES = ['PAID', 'PROCESSING', 'SHIPPED', 'DELIVERED'] as const;

// Shared landing-page dashboard for both roles — revenue is admin-only, so staff get
// the same operational counts (orders, applications, bulk requests) without it.
adminReportsRouter.get(
  '/dashboard',
  asyncHandler(async (req, res) => {
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const isAdmin = req.user!.role === 'ADMIN';

    const [recentOrders, newUsersCount, pendingAuthorApplications, pendingBulkOrders, revenueAgg] = await Promise.all([
      prisma.order.findMany({
        take: 8,
        orderBy: { createdAt: 'desc' },
        include: { user: { select: { name: true, email: true } } },
      }),
      isAdmin ? prisma.user.count({ where: { createdAt: { gte: sevenDaysAgo } } }) : Promise.resolve(null),
      prisma.authorApplication.count({ where: { status: { in: ['SUBMITTED', 'UNDER_REVIEW', 'INFO_REQUESTED'] } } }),
      prisma.bulkOrderRequest.count({ where: { status: { in: ['SUBMITTED', 'ASSIGNED', 'QUOTE_IN_PROGRESS'] } } }),
      isAdmin ? prisma.order.aggregate({ where: { status: { in: [...PAID_STATUSES] } }, _sum: { totalMinor: true } }) : Promise.resolve(null),
    ]);

    res.json({
      recentOrders,
      pendingAuthorApplications,
      pendingBulkOrders,
      ...(isAdmin
        ? { newUsersCount, totalRevenue: (revenueAgg!._sum.totalMinor ?? 0) / 100 }
        : { newUsersCount: null, totalRevenue: null }),
    });
  }),
);

// Detailed sales/financial analytics — admin-only.
adminReportsRouter.use('/sales', requireRole('ADMIN'));

const reportQuerySchema = z.object({
  query: z.object({
    from: z.string().datetime().optional(),
    to: z.string().datetime().optional(),
  }),
});

adminReportsRouter.get(
  '/sales',
  validate({ query: reportQuerySchema.shape.query }),
  asyncHandler(async (req, res) => {
    const { from, to } = req.query as unknown as z.infer<typeof reportQuerySchema>['query'];
    const dateFilter = {
      ...(from ? { gte: new Date(from) } : {}),
      ...(to ? { lte: new Date(to) } : {}),
    };
    const where = Object.keys(dateFilter).length ? { createdAt: dateFilter } : {};

    const [byStatus, orderItems] = await Promise.all([
      prisma.order.groupBy({ by: ['status'], where, _count: { _all: true }, _sum: { totalMinor: true, discountMinor: true } }),
      prisma.orderItem.findMany({
        where: { order: { ...where, status: { in: [...PAID_STATUSES] } } },
        select: { titleSnapshot: true, quantity: true, lineTotalMinor: true },
      }),
    ]);

    const bestSellerMap = new Map<string, { title: string; unitsSold: number; revenue: number }>();
    for (const item of orderItems) {
      const entry = bestSellerMap.get(item.titleSnapshot) ?? { title: item.titleSnapshot, unitsSold: 0, revenue: 0 };
      entry.unitsSold += item.quantity;
      entry.revenue += item.lineTotalMinor / 100;
      bestSellerMap.set(item.titleSnapshot, entry);
    }
    const bestSellers = [...bestSellerMap.values()].sort((a, b) => b.unitsSold - a.unitsSold).slice(0, 10);

    res.json({
      byStatus: byStatus.map((row) => ({
        status: row.status,
        orders: row._count._all,
        grossSales: (row._sum.totalMinor ?? 0) / 100,
        discounts: (row._sum.discountMinor ?? 0) / 100,
      })),
      bestSellers,
    });
  }),
);
