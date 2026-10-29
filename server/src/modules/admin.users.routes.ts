import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { AppError } from '../lib/errors.js';
import { asyncHandler } from '../lib/asyncHandler.js';
import { validate } from '../middleware/validate.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { recordAudit } from '../lib/audit.js';
import { pageMeta, paginate, paginationQuery } from '../lib/validation.js';
import { revokeAllSessions } from './auth.routes.js';

export const adminUsersRouter = Router();
// User administration (viewing accounts, roles, activation) is admin-only — staff do not
// get a users panel at all, not just a read-only one, since even the list exposes every
// customer's email address.
adminUsersRouter.use(requireAuth, requireRole('ADMIN'));

const listQuery = z.object({
  q: z.string().trim().max(200).optional(),
  role: z.enum(['CUSTOMER', 'STAFF', 'ADMIN']).optional(),
  ...paginationQuery(),
});

adminUsersRouter.get(
  '/',
  validate({ query: listQuery }),
  asyncHandler(async (req, res) => {
    const { q, role, page, pageSize } = req.query as unknown as z.infer<typeof listQuery>;
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
        ...paginate(page, pageSize),
      }),
    ]);

    res.json({ items: users, ...pageMeta(page, pageSize, total) });
  }),
);

const updateBody = z.object({
  role: z.enum(['CUSTOMER', 'STAFF', 'ADMIN']).optional(),
  isActive: z.boolean().optional(),
});

adminUsersRouter.patch(
  '/:id',
  validate({ body: updateBody }),
  asyncHandler(async (req, res) => {
    const body = req.body as z.infer<typeof updateBody>;
    // The router is already admin-only; these guard against an admin locking everyone out.
    if (req.params.id === req.user!.id && (body.isActive === false || (body.role && body.role !== 'ADMIN'))) {
      throw AppError.badRequest('You cannot deactivate or demote your own account');
    }

    const existing = await prisma.user.findUnique({ where: { id: req.params.id } });
    if (!existing) throw AppError.notFound('User not found');

    const user = await prisma.user.update({
      where: { id: req.params.id },
      data: body,
      select: { id: true, name: true, email: true, role: true, isActive: true },
    });

    if (body.isActive === false) await revokeAllSessions(user.id);

    await recordAudit({
      actorUserId: req.user!.id,
      action: 'USER_UPDATED',
      entityType: 'User',
      entityId: user.id,
      metadata: { ...body, previousRole: existing.role, previouslyActive: existing.isActive },
    });

    res.json({ user });
  }),
);
