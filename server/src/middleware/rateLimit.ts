import rateLimit from 'express-rate-limit';

/** Throttles brute-force attempts on login, registration, refresh and password-reset requests. */
export const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: { code: 'RATE_LIMITED', message: 'Too many attempts — please try again later.' } },
});

/** Throttles abuse of unauthenticated public forms (contact, bulk order, manuscript submission). */
export const publicFormRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: { code: 'RATE_LIMITED', message: 'Too many submissions — please try again later.' } },
});
