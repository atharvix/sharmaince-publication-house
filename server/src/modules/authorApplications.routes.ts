import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { AppError } from '../lib/errors.js';
import { asyncHandler } from '../lib/asyncHandler.js';
import { validate } from '../middleware/validate.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { recordAudit } from '../lib/audit.js';
import { publicFormRateLimiter } from '../middleware/rateLimit.js';
import { emailSchema, pageMeta, paginate, paginationQuery } from '../lib/validation.js';

export const authorApplicationsRouter = Router();

const createSchema = z.object({
  body: z.object({
    name: z.string().min(1).max(120),
    email: emailSchema,
    subjectArea: z.string().min(1).max(80),
    workingTitle: z.string().min(1).max(200),
    synopsis: z.string().min(1).max(4000),
  }),
});

authorApplicationsRouter.post(
  '/',
  publicFormRateLimiter,
  validate({ body: createSchema.shape.body }),
  asyncHandler(async (req, res) => {
    const application = await prisma.authorApplication.create({ data: req.body });
    res.status(201).json({ application: { id: application.id, status: application.status } });
  }),
);

// ---------- Staff review ----------

authorApplicationsRouter.use('/admin', requireAuth, requireRole('STAFF', 'ADMIN'));

const adminListQuery = z.object(paginationQuery(50));

authorApplicationsRouter.get(
  '/admin',
  validate({ query: adminListQuery }),
  asyncHandler(async (req, res) => {
    const { page, pageSize } = req.query as unknown as z.infer<typeof adminListQuery>;
    const [total, items] = await Promise.all([
      prisma.authorApplication.count(),
      prisma.authorApplication.findMany({
        include: { notes: { include: { authorUser: { select: { name: true } } }, orderBy: { createdAt: 'desc' } } },
        orderBy: { createdAt: 'desc' },
        ...paginate(page, pageSize),
      }),
    ]);
    res.json({ items, ...pageMeta(page, pageSize, total) });
  }),
);

const updateStatusSchema = z.object({
  body: z.object({
    status: z.enum(['SUBMITTED', 'UNDER_REVIEW', 'INFO_REQUESTED', 'ACCEPTED', 'DECLINED', 'WITHDRAWN', 'CLOSED']),
  }),
});

authorApplicationsRouter.patch(
  '/admin/:id/status',
  validate({ body: updateStatusSchema.shape.body }),
  asyncHandler(async (req, res) => {
    const existing = await prisma.authorApplication.findUnique({ where: { id: req.params.id } });
    if (!existing) throw AppError.notFound('Application not found');

    const application = await prisma.authorApplication.update({ where: { id: req.params.id }, data: { status: req.body.status } });
    await recordAudit({
      actorUserId: req.user!.id,
      action: 'AUTHOR_APPLICATION_STATUS_CHANGED',
      entityType: 'AuthorApplication',
      entityId: application.id,
      metadata: { status: req.body.status },
    });
    res.json({ application });
  }),
);

const addNoteSchema = z.object({ body: z.object({ note: z.string().min(1).max(2000) }) });

authorApplicationsRouter.post(
  '/admin/:id/notes',
  validate({ body: addNoteSchema.shape.body }),
  asyncHandler(async (req, res) => {
    const existing = await prisma.authorApplication.findUnique({ where: { id: req.params.id } });
    if (!existing) throw AppError.notFound('Application not found');

    const note = await prisma.authorApplicationNote.create({
      data: { applicationId: req.params.id, authorUserId: req.user!.id, note: req.body.note },
    });
    res.status(201).json({ note });
  }),
);
