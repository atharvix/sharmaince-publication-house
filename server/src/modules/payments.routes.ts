import { Router } from 'express';
import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { asyncHandler } from '../lib/asyncHandler.js';
import { AppError } from '../lib/errors.js';
import { logger } from '../lib/logger.js';
import { verifyWebhookSignature } from '../lib/razorpay.js';
import { confirmPayment, markPaymentFailed } from './orders.service.js';

export const paymentsRouter = Router();

interface RazorpayWebhookPayload {
  event: string;
  payload: {
    payment?: { entity: { id: string; order_id: string; status: string; amount: number } };
  };
}

/**
 * Razorpay webhook receiver — the authoritative source of payment state, covering
 * customers who close the tab before the browser callback reaches /checkout/verify.
 *
 * Razorpay retries on any non-2xx, so: the event is recorded as processed only after its
 * effects succeed, and a failure returns 500 to get a retry. Handlers are idempotent, so
 * a redelivery that races the first attempt is harmless.
 */
paymentsRouter.post(
  '/webhook',
  asyncHandler(async (req, res) => {
    const signature = req.headers['x-razorpay-signature'];
    // Mounted with express.raw() in app.ts, so req.body is the untouched Buffer needed for signature verification.
    const rawBody = req.body as unknown;

    if (!Buffer.isBuffer(rawBody) || typeof signature !== 'string' || !verifyWebhookSignature(rawBody, signature)) {
      return res.status(400).json({ error: { code: 'INVALID_SIGNATURE', message: 'Webhook signature verification failed' } });
    }

    let body: RazorpayWebhookPayload;
    try {
      body = JSON.parse(rawBody.toString('utf8'));
    } catch {
      return res.status(400).json({ error: { code: 'BAD_REQUEST', message: 'Invalid JSON payload' } });
    }

    // Razorpay sends a unique id per event; fall back to event+entity for older payload formats.
    const headerEventId = req.headers['x-razorpay-event-id'];
    const paymentEntity = body.payload?.payment?.entity;
    const eventId = typeof headerEventId === 'string' ? headerEventId : `${body.event}:${paymentEntity?.id ?? 'unknown'}`;

    if (await prisma.paymentWebhookEvent.findUnique({ where: { eventId }, select: { id: true } })) {
      return res.status(200).json({ message: 'Already processed' });
    }

    if (paymentEntity && (await prisma.payment.findUnique({ where: { razorpayOrderId: paymentEntity.order_id }, select: { id: true } }))) {
      if (body.event === 'payment.captured') {
        try {
          await confirmPayment({
            razorpayOrderId: paymentEntity.order_id,
            razorpayPaymentId: paymentEntity.id,
            amountMinor: paymentEntity.amount,
            source: 'webhook',
          });
        } catch (error) {
          // Validation failures (e.g. amount mismatch) won't fix themselves on retry; they're
          // logged for manual follow-up. Anything else propagates so Razorpay retries.
          if (!(error instanceof AppError)) throw error;
          logger.error({ err: error, eventId }, 'webhook payment rejected');
        }
      } else if (body.event === 'payment.failed') {
        await markPaymentFailed(paymentEntity.order_id);
      }
    } else {
      logger.info({ event: body.event, eventId }, 'webhook ignored: no matching payment');
    }

    try {
      await prisma.paymentWebhookEvent.create({ data: { eventId, eventType: body.event, payload: body as unknown as Prisma.InputJsonObject } });
    } catch (error) {
      // A concurrent delivery of the same event finished first — that's fine.
      if (!(error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002')) throw error;
    }

    res.status(200).json({ message: 'Processed' });
  }),
);
