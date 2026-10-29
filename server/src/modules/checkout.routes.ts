import { Router } from 'express';
import crypto from 'node:crypto';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { AppError } from '../lib/errors.js';
import { asyncHandler } from '../lib/asyncHandler.js';
import { requireAuth } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { addressSchema, type AddressInput } from '../lib/address.js';
import { minorToRupees } from '../lib/money.js';
import { recordAudit } from '../lib/audit.js';
import { createRazorpayOrder, verifyPaymentSignature } from '../lib/razorpay.js';
import { MAX_QUANTITY_PER_TITLE, priceCart, type PricedQuote } from './pricing.js';
import { cancelUnpaidOrder, confirmPayment, markPaymentFailed } from './orders.service.js';
import { env } from '../env.js';

export const checkoutRouter = Router();
checkoutRouter.use(requireAuth);

const lineSchema = z.object({
  bookId: z.string().min(1),
  quantity: z.coerce.number().int().min(1).max(MAX_QUANTITY_PER_TITLE),
});
const itemsSchema = z.array(lineSchema).min(1).max(50);

const quoteBody = z.object({ items: itemsSchema, promotionCode: z.string().trim().max(40).optional() });

checkoutRouter.post(
  '/quote',
  validate({ body: quoteBody }),
  asyncHandler(async (req, res) => {
    const { items, promotionCode } = req.body as z.infer<typeof quoteBody>;
    res.json({ quote: serializeQuote(await priceCart(items, promotionCode)) });
  }),
);

const createOrderBody = z
  .object({
    items: itemsSchema,
    promotionCode: z.string().trim().max(40).optional(),
    shippingAddressId: z.string().optional(),
    shippingAddress: addressSchema.optional(),
  })
  .refine((data) => data.shippingAddressId || data.shippingAddress, { message: 'A shipping address is required' });

function generateOrderNumber() {
  const stamp = Date.now().toString(36).toUpperCase();
  const random = crypto.randomBytes(4).toString('hex').toUpperCase();
  return `NAP-${stamp}-${random}`;
}

async function resolveShippingAddress(userId: string, body: z.infer<typeof createOrderBody>): Promise<AddressInput> {
  if (!body.shippingAddressId) return body.shippingAddress!;
  const saved = await prisma.address.findFirst({ where: { id: body.shippingAddressId, userId } });
  if (!saved) throw AppError.notFound('Shipping address not found');
  const { label, fullName, phone, line1, line2, city, state, postalCode, country } = saved;
  return { label, fullName, phone, line1, line2: line2 ?? undefined, city, state, postalCode, country };
}

checkoutRouter.post(
  '/orders',
  validate({ body: createOrderBody }),
  asyncHandler(async (req, res) => {
    const userId = req.user!.id;
    const body = req.body as z.infer<typeof createOrderBody>;
    const quote = await priceCart(body.items, body.promotionCode);
    const shippingAddress = await resolveShippingAddress(userId, body);
    const orderNumber = generateOrderNumber();

    // Created before the transaction: a gateway order that never gets a matching DB row is
    // harmless (nobody can pay it), whereas the reverse would strand reserved stock.
    const razorpayOrder = await createRazorpayOrder({ amountMinor: quote.totalMinor, currency: 'INR', receipt: orderNumber });

    const order = await prisma.$transaction(async (tx) => {
      for (const line of quote.lines) {
        const { count } = await tx.book.updateMany({
          where: { id: line.bookId, status: 'PUBLISHED', stockQuantity: { gte: line.quantity } },
          data: { stockQuantity: { decrement: line.quantity } },
        });
        if (count === 0) throw AppError.conflict(`"${line.title}" no longer has enough stock`);
      }

      if (quote.promotion) {
        const { count } = await tx.promotion.updateMany({
          where: {
            id: quote.promotion.id,
            isActive: true,
            ...(quote.promotion.maxRedemptions !== null ? { redeemedCount: { lt: quote.promotion.maxRedemptions } } : {}),
          },
          data: { redeemedCount: { increment: 1 } },
        });
        if (count === 0) throw AppError.conflict('This promotion code has just run out — remove it and try again');
      }

      return tx.order.create({
        data: {
          orderNumber,
          userId,
          status: 'PENDING_PAYMENT',
          subtotalMinor: quote.subtotalMinor,
          discountMinor: quote.discountMinor,
          shippingMinor: quote.shippingMinor,
          taxMinor: quote.taxMinor,
          totalMinor: quote.totalMinor,
          promotionId: quote.promotion?.id,
          shippingAddress,
          items: {
            create: quote.lines.map((line) => ({
              bookId: line.bookId,
              titleSnapshot: line.title,
              authorSnapshot: line.authorNames,
              priceMinorSnapshot: line.unitPriceMinor,
              quantity: line.quantity,
              lineTotalMinor: line.lineTotalMinor,
            })),
          },
          payments: {
            create: { razorpayOrderId: razorpayOrder.id, amountMinor: quote.totalMinor, currency: 'INR', status: 'CREATED' },
          },
        },
        include: { items: true },
      });
    });

    await recordAudit({ actorUserId: userId, action: 'ORDER_CREATED', entityType: 'Order', entityId: order.id });

    res.status(201).json({
      order,
      payment: {
        razorpayOrderId: razorpayOrder.id,
        amountMinor: order.totalMinor,
        currency: order.currency,
        keyId: env.RAZORPAY_KEY_ID || null,
        simulated: razorpayOrder.simulated,
      },
    });
  }),
);

const verifyBody = z.object({
  orderId: z.string().min(1),
  razorpayOrderId: z.string().min(1),
  razorpayPaymentId: z.string().min(1),
  razorpaySignature: z.string().min(1),
});

checkoutRouter.post(
  '/verify',
  validate({ body: verifyBody }),
  asyncHandler(async (req, res) => {
    const { orderId, razorpayOrderId, razorpayPaymentId, razorpaySignature } = req.body as z.infer<typeof verifyBody>;

    const payment = await prisma.payment.findFirst({
      where: { razorpayOrderId, orderId, order: { userId: req.user!.id } },
      select: { id: true },
    });
    if (!payment) throw AppError.notFound('Order not found');

    if (!verifyPaymentSignature(razorpayOrderId, razorpayPaymentId, razorpaySignature)) {
      await markPaymentFailed(razorpayOrderId);
      throw AppError.badRequest('Payment verification failed');
    }

    const { outcome } = await confirmPayment({
      razorpayOrderId,
      razorpayPaymentId,
      razorpaySignature,
      source: 'checkout',
      actorUserId: req.user!.id,
    });

    if (outcome === 'REFUNDED_LATE_PAYMENT') {
      throw new AppError(
        409,
        'ORDER_EXPIRED',
        'This order expired before your payment completed, so the payment has been refunded. Please place the order again.',
      );
    }

    const order = await prisma.order.findUniqueOrThrow({ where: { id: orderId }, include: { items: true } });
    res.json({ order, ...(outcome === 'ALREADY_PAID' ? { message: 'Payment already verified' } : {}) });
  }),
);

checkoutRouter.post(
  '/orders/:id/cancel',
  asyncHandler(async (req, res) => {
    const order = await prisma.order.findFirst({ where: { id: req.params.id, userId: req.user!.id }, select: { id: true } });
    if (!order) throw AppError.notFound('Order not found');

    if (!(await cancelUnpaidOrder(order.id, req.user!.id, 'cancelled by customer'))) {
      throw AppError.badRequest('Only orders awaiting payment can be cancelled this way');
    }
    res.json({ message: 'Order cancelled' });
  }),
);

function serializeQuote(quote: PricedQuote) {
  return {
    lines: quote.lines,
    subtotal: minorToRupees(quote.subtotalMinor),
    discount: minorToRupees(quote.discountMinor),
    shipping: minorToRupees(quote.shippingMinor),
    tax: minorToRupees(quote.taxMinor),
    total: minorToRupees(quote.totalMinor),
    promotion: quote.promotion && { id: quote.promotion.id, code: quote.promotion.code },
  };
}
