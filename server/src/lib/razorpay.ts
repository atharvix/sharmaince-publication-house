import crypto from 'node:crypto';
import Razorpay from 'razorpay';
import { env, isProduction, isRazorpayConfigured } from '../env.js';
import { AppError } from './errors.js';

const client = isRazorpayConfigured
  ? new Razorpay({ key_id: env.RAZORPAY_KEY_ID, key_secret: env.RAZORPAY_KEY_SECRET })
  : null;

// Simulated payments exist only so checkout can be exercised locally without a gateway
// account. env.ts refuses to boot production without keys; this is a second lock, and
// SIMULATE_PAYMENTS=false turns it off on a server that isn't in production mode yet.
const simulationEnabled = !client && !isProduction && env.SIMULATE_PAYMENTS;

const SIMULATED_ORDER_PREFIX = 'order_dev_';

interface CreateOrderInput {
  amountMinor: number;
  currency: string;
  receipt: string;
}

export interface RazorpayOrderResult {
  id: string;
  simulated: boolean;
}

function requireClient() {
  if (!client) throw new AppError(503, 'PAYMENTS_UNAVAILABLE', "Online payment isn't available yet. Please contact us to place an order.");
  return client;
}

export async function createRazorpayOrder({ amountMinor, currency, receipt }: CreateOrderInput): Promise<RazorpayOrderResult> {
  if (simulationEnabled) {
    return { id: `${SIMULATED_ORDER_PREFIX}${crypto.randomBytes(10).toString('hex')}`, simulated: true };
  }
  const order = await requireClient().orders.create({ amount: amountMinor, currency, receipt });
  return { id: order.id, simulated: false };
}

export function isSimulatedOrder(razorpayOrderId: string) {
  return razorpayOrderId.startsWith(SIMULATED_ORDER_PREFIX);
}

/** The signature a simulated dev payment must present — never accepted outside simulation mode. */
export function simulatedSignatureFor(razorpayOrderId: string, razorpayPaymentId: string) {
  return `simulated.${razorpayOrderId}.${razorpayPaymentId}`;
}

/**
 * Verifies a checkout signature per Razorpay's scheme:
 * HMAC_SHA256(order_id + "|" + payment_id, key_secret) === signature.
 */
export function verifyPaymentSignature(razorpayOrderId: string, razorpayPaymentId: string, signature: string): boolean {
  if (simulationEnabled) {
    return isSimulatedOrder(razorpayOrderId) && signature === simulatedSignatureFor(razorpayOrderId, razorpayPaymentId);
  }
  const expected = crypto
    .createHmac('sha256', env.RAZORPAY_KEY_SECRET)
    .update(`${razorpayOrderId}|${razorpayPaymentId}`)
    .digest('hex');
  return timingSafeEqual(expected, signature);
}

/** Verifies an inbound webhook's `x-razorpay-signature` header against the raw request body. */
export function verifyWebhookSignature(rawBody: Buffer, signature: string): boolean {
  if (!env.RAZORPAY_WEBHOOK_SECRET) return false;
  const expected = crypto.createHmac('sha256', env.RAZORPAY_WEBHOOK_SECRET).update(rawBody).digest('hex');
  return timingSafeEqual(expected, signature);
}

/** Issues a full refund for a captured payment. Simulated payments have nothing to refund. */
export async function refundRazorpayPayment(razorpayOrderId: string, razorpayPaymentId: string, amountMinor: number) {
  if (isSimulatedOrder(razorpayOrderId)) return;
  await requireClient().payments.refund(razorpayPaymentId, { amount: amountMinor });
}

function timingSafeEqual(a: string, b: string) {
  const bufferA = Buffer.from(a);
  const bufferB = Buffer.from(b);
  if (bufferA.length !== bufferB.length) return false;
  return crypto.timingSafeEqual(bufferA, bufferB);
}
