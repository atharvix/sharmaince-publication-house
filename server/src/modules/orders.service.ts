import type { Order, OrderItem, OrderStatus } from '@prisma/client';
import { prisma, type Tx } from '../lib/prisma.js';
import { AppError } from '../lib/errors.js';
import { recordAudit } from '../lib/audit.js';
import { logger } from '../lib/logger.js';
import { refundRazorpayPayment } from '../lib/razorpay.js';
import { sendEmail, orderConfirmationEmail } from '../lib/email.js';
import { formatInr } from '../lib/money.js';
import { env } from '../env.js';

/**
 * Order lifecycle. Every state change is a conditional update on the current status, so
 * concurrent requests (customer cancel vs. webhook vs. admin vs. expiry job) can't both win.
 *
 * Stock and promotion usage are reserved when the order is created and released when it
 * is cancelled — whether by the customer, staff, or the expiry job.
 */

/** Statuses in which money has been taken and not returned. */
export const PAID_STATUSES = ['PAID', 'PROCESSING', 'SHIPPED', 'DELIVERED'] as const satisfies readonly OrderStatus[];

export const ADMIN_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  PENDING_PAYMENT: ['CANCELLED'],
  PAID: ['PROCESSING', 'CANCELLED'],
  PROCESSING: ['SHIPPED', 'CANCELLED'],
  SHIPPED: ['DELIVERED', 'REFUNDED'],
  DELIVERED: ['REFUNDED'],
  CANCELLED: [],
  REFUNDED: [],
};

type OrderWithItems = Order & { items: OrderItem[] };

async function releaseReservation(tx: Tx, order: OrderWithItems) {
  for (const item of order.items) {
    await tx.book.update({ where: { id: item.bookId }, data: { stockQuantity: { increment: item.quantity } } });
  }
  if (order.promotionId) {
    await tx.promotion.updateMany({
      where: { id: order.promotionId, redeemedCount: { gt: 0 } },
      data: { redeemedCount: { decrement: 1 } },
    });
  }
}

/** Moves an order from `from` to `to` only if it is still in `from`. Returns false if someone else got there first. */
async function transition(tx: Tx, orderId: string, from: OrderStatus, to: OrderStatus) {
  const now = new Date();
  const { count } = await tx.order.updateMany({
    where: { id: orderId, status: from },
    data: {
      status: to,
      ...(to === 'PAID' ? { paidAt: now } : {}),
      ...(to === 'SHIPPED' ? { shippedAt: now } : {}),
      ...(to === 'DELIVERED' ? { deliveredAt: now } : {}),
      ...(to === 'CANCELLED' ? { cancelledAt: now } : {}),
    },
  });
  return count === 1;
}

/** Cancels an order that hasn't been paid and releases its stock and promotion use. */
export async function cancelUnpaidOrder(orderId: string, actorUserId: string | null, reason: string) {
  const cancelled = await prisma.$transaction(async (tx) => {
    const order = await tx.order.findUniqueOrThrow({ where: { id: orderId }, include: { items: true } });
    if (!(await transition(tx, orderId, 'PENDING_PAYMENT', 'CANCELLED'))) return false;
    await releaseReservation(tx, order);
    return true;
  });
  if (cancelled) {
    await recordAudit({ actorUserId, action: 'ORDER_CANCELLED', entityType: 'Order', entityId: orderId, metadata: { reason } });
  }
  return cancelled;
}

/** Cancels unpaid orders older than PENDING_ORDER_TTL_MINUTES. Safe to run on several instances at once. */
export async function expireStaleOrders() {
  const cutoff = new Date(Date.now() - env.PENDING_ORDER_TTL_MINUTES * 60_000);
  const stale = await prisma.order.findMany({
    where: { status: 'PENDING_PAYMENT', createdAt: { lt: cutoff } },
    select: { id: true },
    take: 100,
  });
  let expired = 0;
  for (const { id } of stale) {
    if (await cancelUnpaidOrder(id, null, 'payment window expired')) expired += 1;
  }
  if (expired) logger.info({ expired }, 'expired unpaid orders');
  return expired;
}

async function refundCapturedPayment(orderId: string) {
  const payment = await prisma.payment.findFirst({ where: { orderId, status: 'CAPTURED' } });
  if (!payment?.razorpayPaymentId) return null;
  await refundRazorpayPayment(payment.razorpayOrderId, payment.razorpayPaymentId, payment.amountMinor);
  return payment;
}

/**
 * Staff-initiated status change. Cancelling or refunding a paid order refunds the payment
 * through the gateway first; the order only changes state once the money has gone back.
 */
export async function changeOrderStatusAsStaff(orderId: string, to: OrderStatus, actorUserId: string, reason?: string) {
  const order = await prisma.order.findUnique({ where: { id: orderId }, include: { items: true } });
  if (!order) throw AppError.notFound('Order not found');
  if (!ADMIN_TRANSITIONS[order.status].includes(to)) {
    throw AppError.badRequest(`Cannot move an order from ${order.status} to ${to}`);
  }

  if (order.status === 'PENDING_PAYMENT') {
    if (!(await cancelUnpaidOrder(order.id, actorUserId, reason ?? 'cancelled by staff'))) {
      throw AppError.conflict('This order changed while you were editing it — reload and try again');
    }
    return;
  }

  const returnsMoney = to === 'CANCELLED' || to === 'REFUNDED';
  const refunded = returnsMoney ? await refundCapturedPayment(order.id) : null;

  const applied = await prisma.$transaction(async (tx) => {
    if (!(await transition(tx, order.id, order.status, to))) return false;
    // Cancelled orders never shipped, so the books are back on the shelf. Refunds after
    // shipping are restocked separately, once a return actually arrives.
    if (to === 'CANCELLED') await releaseReservation(tx, order);
    if (refunded) await tx.payment.update({ where: { id: refunded.id }, data: { status: 'REFUNDED' } });
    return true;
  });

  if (!applied) {
    if (refunded) {
      logger.error({ orderId: order.id }, 'payment refunded but order status changed concurrently; reconcile manually');
    }
    throw AppError.conflict('This order changed while you were editing it — reload and try again');
  }

  await recordAudit({
    actorUserId,
    action: 'ORDER_STATUS_CHANGED',
    entityType: 'Order',
    entityId: order.id,
    metadata: { from: order.status, to, reason, refunded: Boolean(refunded) },
  });
}

export type PaymentOutcome = 'PAID' | 'ALREADY_PAID' | 'REFUNDED_LATE_PAYMENT';

interface ConfirmPaymentInput {
  razorpayOrderId: string;
  razorpayPaymentId: string;
  razorpaySignature?: string;
  /** Amount reported by the gateway; checked against what we asked for. */
  amountMinor?: number;
  source: 'checkout' | 'webhook';
  actorUserId?: string;
}

/**
 * Records a successful payment. Called from both the browser callback and the webhook —
 * whichever arrives first marks the order paid and sends the confirmation email; the
 * other is a no-op. A payment for an order that was cancelled in the meantime (e.g. it
 * expired while the customer sat on the payment page) is refunded automatically.
 */
export async function confirmPayment(input: ConfirmPaymentInput): Promise<{ outcome: PaymentOutcome; orderId: string }> {
  const payment = await prisma.payment.findUnique({ where: { razorpayOrderId: input.razorpayOrderId } });
  if (!payment) throw AppError.badRequest('Payment record not found');

  if (input.amountMinor !== undefined && input.amountMinor !== payment.amountMinor) {
    logger.error({ paymentId: payment.id, expected: payment.amountMinor, got: input.amountMinor }, 'payment amount mismatch');
    throw AppError.badRequest('Payment amount does not match the order');
  }

  // Already refunded as a late payment — a redelivered webhook must not resurrect it.
  if (payment.status === 'REFUNDED') return { outcome: 'REFUNDED_LATE_PAYMENT', orderId: payment.orderId };

  const outcome = await prisma.$transaction(async (tx): Promise<PaymentOutcome> => {
    await tx.payment.update({
      where: { id: payment.id },
      data: {
        status: 'CAPTURED',
        razorpayPaymentId: input.razorpayPaymentId,
        ...(input.razorpaySignature ? { razorpaySignature: input.razorpaySignature } : {}),
      },
    });
    if (await transition(tx, payment.orderId, 'PENDING_PAYMENT', 'PAID')) return 'PAID';

    const order = await tx.order.findUniqueOrThrow({ where: { id: payment.orderId }, select: { status: true } });
    return (PAID_STATUSES as readonly OrderStatus[]).includes(order.status) ? 'ALREADY_PAID' : 'REFUNDED_LATE_PAYMENT';
  });

  if (outcome === 'PAID') {
    await recordAudit({ actorUserId: input.actorUserId, action: 'ORDER_PAID', entityType: 'Order', entityId: payment.orderId, metadata: { source: input.source } });
    await sendOrderConfirmation(payment.orderId);
  }

  if (outcome === 'REFUNDED_LATE_PAYMENT') await refundLatePayment(payment.id, input);

  return { outcome, orderId: payment.orderId };
}

async function refundLatePayment(paymentId: string, input: ConfirmPaymentInput) {
  // Claim the refund first: the browser callback and the webhook can both get here.
  const { count } = await prisma.payment.updateMany({ where: { id: paymentId, status: 'CAPTURED' }, data: { status: 'REFUNDED' } });
  if (count === 0) return;

  const payment = await prisma.payment.findUniqueOrThrow({ where: { id: paymentId } });
  try {
    await refundRazorpayPayment(payment.razorpayOrderId, input.razorpayPaymentId, payment.amountMinor);
  } catch (error) {
    await prisma.payment.update({ where: { id: paymentId }, data: { status: 'CAPTURED' } });
    logger.error({ err: error, orderId: payment.orderId }, 'automatic refund of late payment failed; refund manually');
    throw error;
  }
  await recordAudit({ action: 'LATE_PAYMENT_REFUNDED', entityType: 'Order', entityId: payment.orderId, metadata: { source: input.source } });
  logger.warn({ orderId: payment.orderId }, 'payment arrived for a cancelled order; refunded');
}

export async function markPaymentFailed(razorpayOrderId: string) {
  await prisma.payment.updateMany({ where: { razorpayOrderId, status: 'CREATED' }, data: { status: 'FAILED' } });
}

async function sendOrderConfirmation(orderId: string) {
  const order = await prisma.order.findUniqueOrThrow({ where: { id: orderId }, include: { user: { select: { email: true } } } });
  const orderUrl = `${env.PUBLIC_WEB_URL}/account/orders/${order.id}`;
  try {
    await sendEmail({ to: order.user.email, ...orderConfirmationEmail(order.orderNumber, formatInr(order.totalMinor), orderUrl) });
  } catch (error) {
    // The payment is recorded; a mail outage shouldn't turn that into an error for the customer.
    logger.error({ err: error, orderId }, 'failed to send order confirmation email');
  }
}
