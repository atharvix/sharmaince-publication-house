import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { AppError } from '../lib/errors.js';
import { asyncHandler } from '../lib/asyncHandler.js';
import { validate } from '../middleware/validate.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { recordAudit } from '../lib/audit.js';

/** Public reads for CMS-managed static pages and FAQs. */
export const contentRouter = Router();

contentRouter.get(
  '/pages/:slug',
  asyncHandler(async (req, res) => {
    const page = await prisma.contentPage.findUnique({
      where: { slug: req.params.slug },
      select: { slug: true, title: true, intro: true, sections: true, isPublished: true, updatedAt: true },
    });
    // Unpublished and missing pages are indistinguishable to the public API, so a page
    // taken down for editing can't be probed for by slug — the frontend falls back to
    // its own static copy either way.
    if (!page || !page.isPublished) throw AppError.notFound('Page not found');
    res.json({ page });
  }),
);

contentRouter.get(
  '/faqs',
  asyncHandler(async (_req, res) => {
    const faqs = await prisma.faq.findMany({ where: { isPublished: true }, orderBy: [{ topic: 'asc' }, { sortOrder: 'asc' }] });
    res.json({ items: faqs });
  }),
);

/** Admin writes for the same CMS content. */
export const adminContentRouter = Router();
adminContentRouter.use(requireAuth, requireRole('STAFF', 'ADMIN'));

adminContentRouter.get(
  '/pages',
  asyncHandler(async (_req, res) => {
    res.json({ items: await prisma.contentPage.findMany({ orderBy: { slug: 'asc' } }) });
  }),
);

const pageSchema = z.object({
  title: z.string().min(1).max(200),
  intro: z.string().max(2000).optional(),
  sections: z.array(z.object({ heading: z.string().min(1), body: z.string().min(1) })),
  isPublished: z.boolean().default(true),
});

adminContentRouter.put(
  '/pages/:slug',
  validate({ body: pageSchema }),
  asyncHandler(async (req, res) => {
    const page = await prisma.contentPage.upsert({
      where: { slug: req.params.slug },
      update: { ...req.body, updatedByUserId: req.user!.id },
      create: { slug: req.params.slug, ...req.body, updatedByUserId: req.user!.id },
    });
    await recordAudit({ actorUserId: req.user!.id, action: 'CONTENT_PAGE_UPDATED', entityType: 'ContentPage', entityId: page.id });
    res.json({ page });
  }),
);

const faqSchema = z.object({
  topic: z.enum(['ORDERS', 'DELIVERY', 'RETURNS', 'SUBMISSIONS', 'ACCOUNTS']),
  question: z.string().min(1).max(300),
  answer: z.string().min(1).max(2000),
  sortOrder: z.number().int().default(0),
  isPublished: z.boolean().default(true),
});

adminContentRouter.get(
  '/faqs',
  asyncHandler(async (_req, res) => {
    res.json({ items: await prisma.faq.findMany({ orderBy: [{ topic: 'asc' }, { sortOrder: 'asc' }] }) });
  }),
);

adminContentRouter.post(
  '/faqs',
  validate({ body: faqSchema }),
  asyncHandler(async (req, res) => {
    const faq = await prisma.faq.create({ data: req.body });
    res.status(201).json({ faq });
  }),
);

adminContentRouter.patch(
  '/faqs/:id',
  validate({ body: faqSchema.partial() }),
  asyncHandler(async (req, res) => {
    const faq = await prisma.faq.update({ where: { id: req.params.id }, data: req.body });
    res.json({ faq });
  }),
);

adminContentRouter.delete(
  '/faqs/:id',
  asyncHandler(async (req, res) => {
    await prisma.faq.delete({ where: { id: req.params.id } });
    res.status(204).send();
  }),
);
