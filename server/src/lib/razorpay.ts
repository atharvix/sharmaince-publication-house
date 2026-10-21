import crypto from 'node:crypto';
import Razorpay from 'razorpay';
import { env, isRazorpayConfigured } from '../env.js';

const client = isRazorpayConfigured
  ? new Razorpay({ key_id: env.RAZORPAY_KEY_ID, key_secret: env.RAZORPAY_KEY_SECRET })
  : null;

export { isRazorpayConfigured };

interface CreateOrderInput {
  amountMinor: number;
  currency: string;
  receipt: string;
}

export interface RazorpayOrderResult {
  id: string;
  simulated: boolean;
}

/**
 * Creates a Razorpay order. When no API keys are configured (local/dev), returns a
 * deterministic simulated order instead, so the full checkout flow can be exercised
 * end-to-end without a real payment-gateway account. Simulated orders are clearly
 * flagged (`simulated: true`) and never treated as proof of payment on their own.
 */
export async function createRazorpayOrder({ amountMinor, currency, receipt }: CreateOrderInput): Promise<RazorpayOrderResult> {
  if (!client) {
    return { id: `order_dev_${crypto.randomBytes(10).toString('hex')}`, simulated: true };
  }

  const order = await client.orders.create({ amount: amountMinor, currency, receipt });
  return { id: order.id, simulated: false };
}

/** The signature a simulated dev payment must present — never valid in a real Razorpay flow. */
export function simulatedSignatureFor(razorpayOrderId: string, razorpayPaymentId: string) {
  return `simulated.${razorpayOrderId}.${razorpayPaymentId}`;
}

/**
 * Verifies a payment signature per Razorpay's documented scheme:
 * HMAC_SHA256(order_id + "|" + payment_id, key_secret) === signature.
 * In dev-simulated mode (no keys configured), accepts only the deterministic
 * simulated signature format — real Razorpay signatures are never valid there either way.
 */
export function verifyPaymentSignature(razorpayOrderId: string, razorpayPaymentId: string, signature: string): boolean {
  if (!isRazorpayConfigured) {
    return signature === simulatedSignatureFor(razorpayOrderId, razorpayPaymentId);
  }

  const expected = crypto
    .createHmac('sha256', env.RAZORPAY_KEY_SECRET)
    .update(`${razorpayOrderId}|${razorpayPaymentId}`)
    .digest('hex');

  return timingSafeEqual(expected, signature);
}

/** Verifies an inbound webhook's `x-razorpay-signature` header against the raw request body. */
export function verifyWebhookSignature(rawBody: string, signature: string): boolean {
  if (!env.RAZORPAY_WEBHOOK_SECRET) return false;
  const expected = crypto.createHmac('sha256', env.RAZORPAY_WEBHOOK_SECRET).update(rawBody).digest('hex');
  return timingSafeEqual(expected, signature);
}

function timingSafeEqual(a: string, b: string) {
  const bufferA = Buffer.from(a);
  const bufferB = Buffer.from(b);
  if (bufferA.length !== bufferB.length) return false;
  return crypto.timingSafeEqual(bufferA, bufferB);
}
