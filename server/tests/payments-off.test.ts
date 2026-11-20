import { afterAll, describe, expect, it, vi } from 'vitest';

describe('SIMULATE_PAYMENTS=false', () => {
  afterAll(() => {
    delete process.env.SIMULATE_PAYMENTS;
    vi.resetModules();
  });

  it('refuses to start a payment instead of faking one', async () => {
    process.env.SIMULATE_PAYMENTS = 'false';
    vi.resetModules();
    const { createRazorpayOrder } = await import('../src/lib/razorpay.js');

    await expect(createRazorpayOrder({ amountMinor: 10_000, currency: 'INR', receipt: 'r-1' })).rejects.toMatchObject({
      status: 503,
      code: 'PAYMENTS_UNAVAILABLE',
    });
  });
});
