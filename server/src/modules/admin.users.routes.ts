import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { AppError } from '../lib/errors.js';
import { asyncHandler } from '../lib/asyncHandler.js';
import { validate } from '../middleware/validate.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { recordAudit } from '../lib/audit.js';

export const adminUsersRouter = Router();
// User administration (viewing accounts, roles, activation) is admin-only — staff do not
// get a users panel at all, not just a read-only one, since even the list exposes every
// customer's email address.
adminUsersRouter.use(requireAuth, requireRole('ADMIN'));

const listQuerySchema = z.object({
  query: z.object({
    q: z.string().optional(),
    role: z.enum(['CUSTOMER', 'STAFF', 'ADMIN']).optional(),
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(25),
  }),
});

adminUsersRouter.get(
  '/',
  validate({ query: listQuerySchema.shape.query }),
  asyncHandler(async (req, res) => {
    const { q, role, page, pageSize } = req.query as unknown as z.infer<typeof listQuerySchema>['query'];
    const where = {
      ...(role ? { role } : {}),
      ...(q ? { OR: [{ email: { contains: q, mode: 'insensitive' as const } }, { name: { contains: q, mode: 'insensitive' as const } }] } : {}),
    };

    const [total, users] = await Promise.all([
      prisma.user.count({ where }),
      prisma.user.findMany({
        where,
        select: { id: true, name: true, email: true, role: true, isActive: true, createdAt: true },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);

    res.json({ items: users, page, pageSize, total, totalPages: Math.ceil(total / pageSize) });
  }),
);

const updateSchema = z.object({
  body: z.object({
    role: z.enum(['CUSTOMER', 'STAFF', 'ADMIN']).optional(),
    isActive: z.boolean().optional(),
  }),
});

adminUsersRouter.patch(
  '/:id',
  validate({ body: updateSchema.shape.body }),
  asyncHandler(async (req, res) => {
    if (req.body.role && req.user!.role !== 'ADMIN') {
      throw AppError.forbidden('Only administrators can change user roles');
    }
    if (req.params.id === req.user!.id && req.body.isActive === false) {
      throw AppError.badRequest('You cannot deactivate your own account');
    }

    const existing = await prisma.user.findUnique({ where: { id: req.params.id } });
    if (!existing) throw AppError.notFound('User not found');

    const user = await prisma.user.update({
      where: { id: req.params.id },
      data: req.body,
      select: { id: true, name: true, email: true, role: true, isActive: true },
    });

    await recordAudit({
      actorUserId: req.user!.id,
      action: 'USER_UPDATED',
      entityType: 'User',
      entityId: user.id,
      metadata: req.body,
    });

    res.json({ user });
  }),
);
