import { Router } from 'express';
import crypto from 'node:crypto';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { AppError } from '../lib/errors.js';
import { asyncHandler } from '../lib/asyncHandler.js';
import { requireAuth } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { priceCart } from './pricing.js';
import { createRazorpayOrder, verifyPaymentSignature } from '../lib/razorpay.js';
import { sendEmail, orderConfirmationEmail } from '../lib/email.js';
import { recordAudit } from '../lib/audit.js';
import { env } from '../env.js';

export const checkoutRouter = Router();
checkoutRouter.use(requireAuth);

const lineSchema = z.object({ bookId: z.string().min(1), quantity: z.coerce.number().int().min(1).max(20) });

const quoteSchema = z.object({
  body: z.object({ items: z.array(lineSchema).min(1), promotionCode: z.string().optional() }),
});

checkoutRouter.post(
  '/quote',
  validate({ body: quoteSchema.shape.body }),
  asyncHandler(async (req, res) => {
    const quote = await priceCart(req.body.items, req.body.promotionCode);
    res.json({ quote: serializeQuote(quote) });
  }),
);

const addressInput = z.object({
  label: z.string().min(1).max(60),
  fullName: z.string().min(1).max(120),
  phone: z.string().min(6).max(20),
  line1: z.string().min(1).max(200),
  line2: z.string().max(200).optional(),
  city: z.string().min(1).max(100),
  state: z.string().min(1).max(100),
  postalCode: z.string().min(1).max(20),
  country: z.string().min(1).max(100).default('India'),
});

const createOrderSchema = z.object({
  body: z.object({
    items: z.array(lineSchema).min(1),
    promotionCode: z.string().optional(),
    shippingAddressId: z.string().optional(),
    shippingAddress: addressInput.optional(),
  }).refine((data) => data.shippingAddressId || data.shippingAddress, {
    message: 'A shipping address is required',
  }),
});

function generateOrderNumber() {
  const stamp = Date.now().toString(36).toUpperCase();
  const random = crypto.randomBytes(2).toString('hex').toUpperCase();
  return `NAP-${stamp}-${random}`;
}

checkoutRouter.post(
  '/orders',
  validate({ body: createOrderSchema.shape.body }),
  asyncHandler(async (req, res) => {
    const userId = req.user!.id;
    const quote = await priceCart(req.body.items, req.body.promotionCode);

    let shippingAddress: z.infer<typeof addressInput>;
    if (req.body.shippingAddressId) {
      const saved = await prisma.address.findUnique({ where: { id: req.body.shippingAddressId } });
      if (!saved || saved.userId !== userId) throw AppError.notFound('Shipping address not found');
      shippingAddress = { ...saved, line2: saved.line2 ?? undefined };
    } else {
      shippingAddress = req.body.shippingAddress!;
    }

    const orderNumber = generateOrderNumber();

    const order = await prisma.$transaction(async (tx) => {
      for (const line of quote.lines) {
        const result = await tx.book.updateMany({
          where: { id: line.bookId, stockQuantity: { gte: line.quantity } },
          data: { stockQuantity: { decrement: line.quantity } },
        });
        if (result.count === 0) {
          throw AppError.conflict(`"${line.title}" no longer has enough stock`);
        }
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
        },
        include: { items: true },
      });
    });

    if (quote.promotion) {
      await prisma.promotion.update({ where: { id: quote.promotion.id }, data: { redeemedCount: { increment: 1 } } });
    }

    const razorpayOrder = await createRazorpayOrder({
      amountMinor: order.totalMinor,
      currency: order.currency,
      receipt: order.orderNumber,
    });

    await prisma.payment.create({
      data: {
        orderId: order.id,
        razorpayOrderId: razorpayOrder.id,
        amountMinor: order.totalMinor,
        currency: order.currency,
        status: 'CREATED',
      },
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

const verifySchema = z.object({
  body: z.object({
    orderId: z.string().min(1),
    razorpayOrderId: z.string().min(1),
    razorpayPaymentId: z.string().min(1),
    razorpaySignature: z.string().min(1),
  }),
});

checkoutRouter.post(
  '/verify',
  validate({ body: verifySchema.shape.body }),
  asyncHandler(async (req, res) => {
    const { orderId, razorpayOrderId, razorpayPaymentId, razorpaySignature } = req.body;

    const order = await prisma.order.findUnique({ where: { id: orderId } });
    if (!order || order.userId !== req.user!.id) throw AppError.notFound('Order not found');

    const payment = await prisma.payment.findUnique({ where: { razorpayOrderId } });
    if (!payment || payment.orderId !== order.id) throw AppError.badRequest('Payment record not found for this order');

    if (order.status === 'PAID' || order.status === 'PROCESSING') {
      return res.json({ order, message: 'Payment already verified' });
    }

    const signatureValid = verifyPaymentSignature(razorpayOrderId, razorpayPaymentId, razorpaySignature);
    if (!signatureValid) {
      await prisma.payment.update({ where: { id: payment.id }, data: { status: 'FAILED' } });
      throw AppError.badRequest('Payment verification failed');
    }

    const [updatedOrder] = await prisma.$transaction([
      prisma.order.update({ where: { id: order.id }, data: { status: 'PAID', paidAt: new Date() }, include: { items: true } }),
      prisma.payment.update({
        where: { id: payment.id },
        data: { status: 'CAPTURED', razorpayPaymentId, razorpaySignature },
      }),
    ]);

    await recordAudit({ actorUserId: req.user!.id, action: 'ORDER_PAID', entityType: 'Order', entityId: order.id });

    const totalDisplay = `₹${(updatedOrder.totalMinor / 100).toLocaleString('en-IN')}`;
    const orderUrl = `${env.PUBLIC_WEB_URL}/account/orders/${updatedOrder.id}`;
    const { subject, html, text } = orderConfirmationEmail(updatedOrder.orderNumber, totalDisplay, orderUrl);
    const user = await prisma.user.findUnique({ where: { id: req.user!.id } });
    if (user) await sendEmail({ to: user.email, subject, html, text });

    res.json({ order: updatedOrder });
  }),
);

checkoutRouter.post(
  '/orders/:id/cancel',
  asyncHandler(async (req, res) => {
    const order = await prisma.order.findUnique({ where: { id: req.params.id }, include: { items: true } });
    if (!order || order.userId !== req.user!.id) throw AppError.notFound('Order not found');
    if (order.status !== 'PENDING_PAYMENT') {
      throw AppError.badRequest('Only orders awaiting payment can be cancelled this way');
    }

    await prisma.$transaction(async (tx) => {
      for (const item of order.items) {
        await tx.book.update({ where: { id: item.bookId }, data: { stockQuantity: { increment: item.quantity } } });
      }
      await tx.order.update({ where: { id: order.id }, data: { status: 'CANCELLED', cancelledAt: new Date() } });
    });

    await recordAudit({ actorUserId: req.user!.id, action: 'ORDER_CANCELLED', entityType: 'Order', entityId: order.id });
    res.json({ message: 'Order cancelled' });
  }),
);

function serializeQuote(quote: Awaited<ReturnType<typeof priceCart>>) {
  return {
    lines: quote.lines,
    subtotal: quote.subtotalMinor / 100,
    discount: quote.discountMinor / 100,
    shipping: quote.shippingMinor / 100,
    tax: quote.taxMinor / 100,
    total: quote.totalMinor / 100,
    promotion: quote.promotion,
  };
}
