import rateLimit from 'express-rate-limit';
import { env } from '../env.js';

// Counters are kept in process memory, so limits are per instance. That's fine for a
// single instance; when scaling out, give these a shared store (e.g. Redis).
const shared = {
  standardHeaders: true,
  legacyHeaders: false,
  // The test suite creates many accounts from one address.
  skip: () => env.NODE_ENV === 'test',
} as const;

/** Throttles brute-force attempts on login, registration, refresh and password-reset requests. */
export const authRateLimiter = rateLimit({
  ...shared,
  windowMs: 15 * 60 * 1000,
  limit: 20,
  message: { error: { code: 'RATE_LIMITED', message: 'Too many attempts — please try again later.' } },
});

/** Throttles abuse of unauthenticated public forms (contact, bulk order, manuscript submission). */
export const publicFormRateLimiter = rateLimit({
  ...shared,
  windowMs: 15 * 60 * 1000,
  limit: 10,
  message: { error: { code: 'RATE_LIMITED', message: 'Too many submissions — please try again later.' } },
});
