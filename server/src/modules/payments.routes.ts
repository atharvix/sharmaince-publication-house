import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { verifyWebhookSignature } from '../lib/razorpay.js';
import { recordAudit } from '../lib/audit.js';

export const paymentsRouter = Router();

interface RazorpayWebhookPayload {
  event: string;
  payload: {
    payment?: { entity: { id: string; order_id: string; status: string } };
    order?: { entity: { id: string } };
  };
}

/**
 * Razorpay webhook receiver. Requires RAZORPAY_WEBHOOK_SECRET to be configured —
 * this endpoint intentionally never falls back to a dev-simulated mode, since it is
 * the authoritative, idempotent source of truth for payment state in production.
 * For local development, the /api/checkout/verify flow (with its own simulated-mode
 * signature check) is what exercises the end-to-end order lifecycle.
 */
paymentsRouter.post('/webhook', async (req, res) => {
  const signature = req.headers['x-razorpay-signature'];
  // Mounted with express.raw() in app.ts, so req.body is the untouched Buffer needed for signature verification.
  const rawBody = req.body as Buffer;

  if (!Buffer.isBuffer(rawBody) || typeof signature !== 'string' || !verifyWebhookSignature(rawBody.toString('utf8'), signature)) {
    return res.status(400).json({ error: { code: 'INVALID_SIGNATURE', message: 'Webhook signature verification failed' } });
  }

  let body: RazorpayWebhookPayload;
  try {
    body = JSON.parse(rawBody.toString('utf8'));
  } catch {
    return res.status(400).json({ error: { code: 'BAD_REQUEST', message: 'Invalid JSON payload' } });
  }

  const paymentEntity = body.payload.payment?.entity;
  const eventId = `${body.event}:${paymentEntity?.id ?? body.payload.order?.entity.id ?? 'unknown'}`;

  const alreadyProcessed = await prisma.paymentWebhookEvent.findUnique({ where: { eventId } });
  if (alreadyProcessed) {
    return res.status(200).json({ message: 'Already processed' });
  }

  await prisma.paymentWebhookEvent.create({ data: { eventId, eventType: body.event, payload: body as unknown as object } });

  if (paymentEntity && (body.event === 'payment.captured' || body.event === 'payment.failed')) {
    const payment = await prisma.payment.findUnique({ where: { razorpayOrderId: paymentEntity.order_id } });

    if (payment) {
      if (body.event === 'payment.captured' && payment.status !== 'CAPTURED') {
        await prisma.$transaction([
          prisma.payment.update({
            where: { id: payment.id },
            data: { status: 'CAPTURED', razorpayPaymentId: paymentEntity.id },
          }),
          prisma.order.update({ where: { id: payment.orderId }, data: { status: 'PAID', paidAt: new Date() } }),
        ]);
        await recordAudit({ action: 'ORDER_PAID_VIA_WEBHOOK', entityType: 'Order', entityId: payment.orderId });
      }

      if (body.event === 'payment.failed' && payment.status === 'CREATED') {
        await prisma.payment.update({ where: { id: payment.id }, data: { status: 'FAILED' } });
      }
    }
  }

  res.status(200).json({ message: 'Processed' });
});
