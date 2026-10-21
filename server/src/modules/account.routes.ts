import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { AppError } from '../lib/errors.js';
import { asyncHandler } from '../lib/asyncHandler.js';
import { requireAuth } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { hashPassword, isStrongPassword, verifyPassword } from '../lib/password.js';

export const accountRouter = Router();
accountRouter.use(requireAuth);

// ---------- Profile ----------

accountRouter.get(
  '/profile',
  asyncHandler(async (req, res) => {
    const user = await prisma.user.findUniqueOrThrow({ where: { id: req.user!.id } });
    res.json({ profile: { id: user.id, name: user.name, email: user.email, role: user.role } });
  }),
);

const updateProfileSchema = z.object({ body: z.object({ name: z.string().min(2).max(120) }) });

accountRouter.patch(
  '/profile',
  validate({ body: updateProfileSchema.shape.body }),
  asyncHandler(async (req, res) => {
    const user = await prisma.user.update({ where: { id: req.user!.id }, data: { name: req.body.name } });
    res.json({ profile: { id: user.id, name: user.name, email: user.email, role: user.role } });
  }),
);

const changePasswordSchema = z.object({
  body: z.object({
    currentPassword: z.string().min(1),
    newPassword: z.string().min(8).refine(isStrongPassword, {
      message: 'Password must include an uppercase letter, a lowercase letter and a number',
    }),
  }),
});

accountRouter.post(
  '/change-password',
  validate({ body: changePasswordSchema.shape.body }),
  asyncHandler(async (req, res) => {
    const user = await prisma.user.findUniqueOrThrow({ where: { id: req.user!.id } });
    const ok = await verifyPassword(req.body.currentPassword, user.passwordHash);
    if (!ok) throw AppError.badRequest('Current password is incorrect');

    await prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash: await hashPassword(req.body.newPassword),
        refreshTokenVersion: { increment: 1 },
      },
    });
    res.json({ message: 'Password updated' });
  }),
);

// ---------- Addresses ----------

const addressSchema = z.object({
  label: z.string().min(1).max(60),
  fullName: z.string().min(1).max(120),
  phone: z.string().min(6).max(20),
  line1: z.string().min(1).max(200),
  line2: z.string().max(200).optional(),
  city: z.string().min(1).max(100),
  state: z.string().min(1).max(100),
  postalCode: z.string().min(1).max(20),
  country: z.string().min(1).max(100).default('India'),
  isDefaultShipping: z.boolean().optional(),
  isDefaultBilling: z.boolean().optional(),
});

accountRouter.get(
  '/addresses',
  asyncHandler(async (req, res) => {
    const addresses = await prisma.address.findMany({ where: { userId: req.user!.id }, orderBy: { createdAt: 'desc' } });
    res.json({ items: addresses });
  }),
);

accountRouter.post(
  '/addresses',
  validate({ body: addressSchema }),
  asyncHandler(async (req, res) => {
    if (req.body.isDefaultShipping) {
      await prisma.address.updateMany({ where: { userId: req.user!.id }, data: { isDefaultShipping: false } });
    }
    if (req.body.isDefaultBilling) {
      await prisma.address.updateMany({ where: { userId: req.user!.id }, data: { isDefaultBilling: false } });
    }
    const address = await prisma.address.create({ data: { ...req.body, userId: req.user!.id } });
    res.status(201).json({ address });
  }),
);

async function ownAddressOrThrow(userId: string, addressId: string) {
  const address = await prisma.address.findUnique({ where: { id: addressId } });
  if (!address || address.userId !== userId) throw AppError.notFound('Address not found');
  return address;
}

accountRouter.patch(
  '/addresses/:id',
  validate({ body: addressSchema.partial() }),
  asyncHandler(async (req, res) => {
    await ownAddressOrThrow(req.user!.id, req.params.id);
    if (req.body.isDefaultShipping) {
      await prisma.address.updateMany({ where: { userId: req.user!.id }, data: { isDefaultShipping: false } });
    }
    if (req.body.isDefaultBilling) {
      await prisma.address.updateMany({ where: { userId: req.user!.id }, data: { isDefaultBilling: false } });
    }
    const address = await prisma.address.update({ where: { id: req.params.id }, data: req.body });
    res.json({ address });
  }),
);

accountRouter.delete(
  '/addresses/:id',
  asyncHandler(async (req, res) => {
    await ownAddressOrThrow(req.user!.id, req.params.id);
    await prisma.address.delete({ where: { id: req.params.id } });
    res.status(204).send();
  }),
);

// ---------- Wishlist ----------

accountRouter.get(
  '/wishlist',
  asyncHandler(async (req, res) => {
    const items = await prisma.wishlistItem.findMany({
      where: { userId: req.user!.id },
      include: { book: { include: { category: true, authors: { include: { author: true } } } } },
      orderBy: { createdAt: 'desc' },
    });
    res.json({ items });
  }),
);

accountRouter.post(
  '/wishlist',
  validate({ body: z.object({ bookId: z.string().min(1) }) }),
  asyncHandler(async (req, res) => {
    const book = await prisma.book.findUnique({ where: { id: req.body.bookId } });
    if (!book) throw AppError.notFound('Book not found');

    const item = await prisma.wishlistItem.upsert({
      where: { userId_bookId: { userId: req.user!.id, bookId: book.id } },
      update: {},
      create: { userId: req.user!.id, bookId: book.id },
    });
    res.status(201).json({ item });
  }),
);

accountRouter.delete(
  '/wishlist/:bookId',
  asyncHandler(async (req, res) => {
    await prisma.wishlistItem
      .delete({ where: { userId_bookId: { userId: req.user!.id, bookId: req.params.bookId } } })
      .catch(() => null);
    res.status(204).send();
  }),
);

// ---------- Orders ----------

accountRouter.get(
  '/orders',
  asyncHandler(async (req, res) => {
    const orders = await prisma.order.findMany({
      where: { userId: req.user!.id },
      include: { items: true },
      orderBy: { createdAt: 'desc' },
    });
    res.json({ items: orders });
  }),
);

accountRouter.get(
  '/orders/:id',
  asyncHandler(async (req, res) => {
    const order = await prisma.order.findUnique({
      where: { id: req.params.id },
      include: { items: true, payments: { select: { status: true, provider: true, createdAt: true } } },
    });
    if (!order || order.userId !== req.user!.id) throw AppError.notFound('Order not found');
    res.json({ order });
  }),
);
