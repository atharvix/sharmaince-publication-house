import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { AppError } from '../lib/errors.js';
import { asyncHandler } from '../lib/asyncHandler.js';
import { requireAuth } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { hashPassword, passwordSchema, verifyPassword } from '../lib/password.js';
import { addressSchema } from '../lib/address.js';
import { pageMeta, paginate, paginationQuery } from '../lib/validation.js';
import { revokeAllSessions } from './auth.routes.js';

export const accountRouter = Router();
accountRouter.use(requireAuth);

function serializeProfile(user: { id: string; name: string; email: string; role: string }) {
  return { id: user.id, name: user.name, email: user.email, role: user.role };
}

// ---------- Profile ----------

accountRouter.get(
  '/profile',
  asyncHandler(async (req, res) => {
    const user = await prisma.user.findUniqueOrThrow({ where: { id: req.user!.id } });
    res.json({ profile: serializeProfile(user) });
  }),
);

accountRouter.patch(
  '/profile',
  validate({ body: z.object({ name: z.string().trim().min(2).max(120) }) }),
  asyncHandler(async (req, res) => {
    const user = await prisma.user.update({ where: { id: req.user!.id }, data: { name: req.body.name } });
    res.json({ profile: serializeProfile(user) });
  }),
);

const changePasswordBody = z.object({ currentPassword: z.string().min(1).max(200), newPassword: passwordSchema });

accountRouter.post(
  '/change-password',
  validate({ body: changePasswordBody }),
  asyncHandler(async (req, res) => {
    const { currentPassword, newPassword } = req.body as z.infer<typeof changePasswordBody>;
    const user = await prisma.user.findUniqueOrThrow({ where: { id: req.user!.id } });
    if (!(await verifyPassword(currentPassword, user.passwordHash))) {
      throw AppError.badRequest('Current password is incorrect');
    }

    await prisma.user.update({ where: { id: user.id }, data: { passwordHash: await hashPassword(newPassword) } });
    // Signs out every device, including this one, so a leaked session can't outlive the old password.
    await revokeAllSessions(user.id);
    res.json({ message: 'Password updated — please sign in again.' });
  }),
);

// ---------- Addresses ----------

const accountAddressSchema = addressSchema.extend({
  isDefaultShipping: z.boolean().optional(),
  isDefaultBilling: z.boolean().optional(),
});
type AccountAddressInput = Partial<z.infer<typeof accountAddressSchema>>;

accountRouter.get(
  '/addresses',
  asyncHandler(async (req, res) => {
    const addresses = await prisma.address.findMany({ where: { userId: req.user!.id }, orderBy: { createdAt: 'desc' } });
    res.json({ items: addresses });
  }),
);

/** Saves an address, clearing the previous default(s) in the same transaction so there's only ever one. */
function saveAddress(userId: string, data: AccountAddressInput, addressId?: string) {
  return prisma.$transaction(async (tx) => {
    if (data.isDefaultShipping) {
      await tx.address.updateMany({ where: { userId, isDefaultShipping: true }, data: { isDefaultShipping: false } });
    }
    if (data.isDefaultBilling) {
      await tx.address.updateMany({ where: { userId, isDefaultBilling: true }, data: { isDefaultBilling: false } });
    }
    return addressId
      ? tx.address.update({ where: { id: addressId }, data })
      : tx.address.create({ data: { ...(data as z.infer<typeof accountAddressSchema>), userId } });
  });
}

async function assertOwnAddress(userId: string, addressId: string) {
  const address = await prisma.address.findFirst({ where: { id: addressId, userId }, select: { id: true } });
  if (!address) throw AppError.notFound('Address not found');
}

accountRouter.post(
  '/addresses',
  validate({ body: accountAddressSchema }),
  asyncHandler(async (req, res) => {
    const address = await saveAddress(req.user!.id, req.body);
    res.status(201).json({ address });
  }),
);

accountRouter.patch(
  '/addresses/:id',
  validate({ body: accountAddressSchema.partial() }),
  asyncHandler(async (req, res) => {
    await assertOwnAddress(req.user!.id, req.params.id);
    const address = await saveAddress(req.user!.id, req.body, req.params.id);
    res.json({ address });
  }),
);

accountRouter.delete(
  '/addresses/:id',
  asyncHandler(async (req, res) => {
    const { count } = await prisma.address.deleteMany({ where: { id: req.params.id, userId: req.user!.id } });
    if (count === 0) throw AppError.notFound('Address not found');
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
    const book = await prisma.book.findFirst({ where: { id: req.body.bookId, status: 'PUBLISHED' }, select: { id: true } });
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
    // Idempotent: removing something that isn't there is still a success.
    await prisma.wishlistItem.deleteMany({ where: { userId: req.user!.id, bookId: req.params.bookId } });
    res.status(204).send();
  }),
);

// ---------- Orders ----------

const ordersQuery = z.object(paginationQuery(50));

accountRouter.get(
  '/orders',
  validate({ query: ordersQuery }),
  asyncHandler(async (req, res) => {
    const { page, pageSize } = req.query as unknown as z.infer<typeof ordersQuery>;
    const where = { userId: req.user!.id };
    const [total, orders] = await Promise.all([
      prisma.order.count({ where }),
      prisma.order.findMany({ where, include: { items: true }, orderBy: { createdAt: 'desc' }, ...paginate(page, pageSize) }),
    ]);
    res.json({ items: orders, ...pageMeta(page, pageSize, total) });
  }),
);

accountRouter.get(
  '/orders/:id',
  asyncHandler(async (req, res) => {
    const order = await prisma.order.findFirst({
      where: { id: req.params.id, userId: req.user!.id },
      include: { items: true, payments: { select: { status: true, provider: true, createdAt: true } } },
    });
    if (!order) throw AppError.notFound('Order not found');
    res.json({ order });
  }),
);
