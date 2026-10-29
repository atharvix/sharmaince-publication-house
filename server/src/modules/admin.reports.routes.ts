import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { asyncHandler } from '../lib/asyncHandler.js';
import { validate } from '../middleware/validate.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { minorToRupees } from '../lib/money.js';
import { PAID_STATUSES } from './orders.service.js';

export const adminReportsRouter = Router();
adminReportsRouter.use(requireAuth, requireRole('STAFF', 'ADMIN'));

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
        ? { newUsersCount, totalRevenue: minorToRupees(revenueAgg!._sum.totalMinor ?? 0) }
        : { newUsersCount: null, totalRevenue: null }),
    });
  }),
);

// Detailed sales/financial analytics — admin-only.
adminReportsRouter.use('/sales', requireRole('ADMIN'));

const reportQuery = z.object({
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
});

adminReportsRouter.get(
  '/sales',
  validate({ query: reportQuery }),
  asyncHandler(async (req, res) => {
    const { from, to } = req.query as unknown as z.infer<typeof reportQuery>;
    const dateFilter = {
      ...(from ? { gte: new Date(from) } : {}),
      ...(to ? { lte: new Date(to) } : {}),
    };
    const where = Object.keys(dateFilter).length ? { createdAt: dateFilter } : {};

    const [byStatus, bestSellerRows] = await Promise.all([
      prisma.order.groupBy({ by: ['status'], where, _count: { _all: true }, _sum: { totalMinor: true, discountMinor: true } }),
      prisma.orderItem.groupBy({
        by: ['bookId'],
        where: { order: { ...where, status: { in: [...PAID_STATUSES] } } },
        _sum: { quantity: true, lineTotalMinor: true },
        orderBy: { _sum: { quantity: 'desc' } },
        take: 10,
      }),
    ]);

    const titles = await prisma.book.findMany({
      where: { id: { in: bestSellerRows.map((row) => row.bookId) } },
      select: { id: true, title: true },
    });
    const titleById = new Map(titles.map((book) => [book.id, book.title]));
    const bestSellers = bestSellerRows.map((row) => ({
      title: titleById.get(row.bookId) ?? 'Unknown title',
      unitsSold: row._sum.quantity ?? 0,
      revenue: minorToRupees(row._sum.lineTotalMinor ?? 0),
    }));

    res.json({
      byStatus: byStatus.map((row) => ({
        status: row.status,
        orders: row._count._all,
        grossSales: minorToRupees(row._sum.totalMinor ?? 0),
        discounts: minorToRupees(row._sum.discountMinor ?? 0),
      })),
      bestSellers,
    });
  }),
);
