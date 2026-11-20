import { config } from 'dotenv';
import { z } from 'zod';

// In test runs (NODE_ENV=test, set automatically by vitest), prefer `.env.test` so
// tests hit an isolated database and never mutate development data. Values not
// present in `.env.test` still fall back to `.env` (dotenv does not override
// already-set variables).
if (process.env.NODE_ENV === 'test') {
  config({ path: '.env.test' });
}
config();

const durationPattern = /^\d+[smhd]$/;
const DURATION_UNITS_MS = { s: 1_000, m: 60_000, h: 3_600_000, d: 86_400_000 } as const;

/** Parses a `15m` / `30d` style duration into milliseconds. */
export function durationToMs(value: string) {
  const unit = value.slice(-1) as keyof typeof DURATION_UNITS_MS;
  return Number(value.slice(0, -1)) * DURATION_UNITS_MS[unit];
}

const schema = z
  .object({
    PORT: z.coerce.number().int().positive().default(4000),
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).optional(),
    DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
    // Comma-separated list of allowed browser origins.
    CORS_ORIGIN: z
      .string()
      .default('http://localhost:5173')
      .transform((value) => value.split(',').map((origin) => origin.trim()).filter(Boolean)),
    // Number of reverse proxies in front of the app (load balancer, ingress). Needed so
    // req.ip — and therefore rate limiting — sees the client, not the proxy.
    TRUST_PROXY: z.coerce.number().int().min(0).default(0),

    JWT_ACCESS_SECRET: z.string().min(32, 'JWT_ACCESS_SECRET must be at least 32 characters'),
    JWT_REFRESH_SECRET: z.string().min(32, 'JWT_REFRESH_SECRET must be at least 32 characters'),
    JWT_ACCESS_TTL: z.string().regex(durationPattern).default('15m'),
    JWT_REFRESH_TTL: z.string().regex(durationPattern).default('30d'),

    RAZORPAY_KEY_ID: z.string().default(''),
    RAZORPAY_KEY_SECRET: z.string().default(''),
    RAZORPAY_WEBHOOK_SECRET: z.string().default(''),

    // Unpaid orders release their reserved stock after this many minutes.
    PENDING_ORDER_TTL_MINUTES: z.coerce.number().int().positive().default(30),

    // Fake payments for local testing when Razorpay isn't configured (never in production).
    // Set to false on any server real people can reach, so nobody can place a fake paid order.
    SIMULATE_PAYMENTS: z
      .enum(['true', 'false'])
      .default('true')
      .transform((value) => value === 'true'),
    // Optional: lets staff fill a new book's details from its cover photo (src/lib/coverReader.ts).
    ANTHROPIC_API_KEY: z.string().default(''),
    SMTP_HOST: z.string().default(''),
    SMTP_PORT: z.coerce.number().default(587),
    SMTP_USER: z.string().default(''),
    SMTP_PASSWORD: z.string().default(''),
    EMAIL_FROM: z.string().default('Sharmiance Publication House <no-reply@sharmiance.example>'),

    PUBLIC_WEB_URL: z.string().url().default('http://localhost:5173'),
    UPLOADS_DIR: z.string().default('uploads'),
  })
  .superRefine((value, ctx) => {
    if (value.JWT_ACCESS_SECRET === value.JWT_REFRESH_SECRET) {
      ctx.addIssue({ code: 'custom', path: ['JWT_REFRESH_SECRET'], message: 'Must differ from JWT_ACCESS_SECRET' });
    }
    if (value.NODE_ENV !== 'production') return;
    // Production must never fall back to simulated payments or console email.
    for (const key of ['RAZORPAY_KEY_ID', 'RAZORPAY_KEY_SECRET', 'RAZORPAY_WEBHOOK_SECRET', 'SMTP_HOST'] as const) {
      if (!value[key]) ctx.addIssue({ code: 'custom', path: [key], message: `${key} is required in production` });
    }
    if (!value.PUBLIC_WEB_URL.startsWith('https://')) {
      ctx.addIssue({ code: 'custom', path: ['PUBLIC_WEB_URL'], message: 'Must be https in production' });
    }
  });

const parsed = schema.safeParse(process.env);

if (!parsed.success) {
  console.error('Invalid environment configuration:', parsed.error.flatten().fieldErrors);
  throw new Error('Invalid environment configuration — check .env against .env.example');
}

export const env = parsed.data;

export const isProduction = env.NODE_ENV === 'production';
export const isRazorpayConfigured = Boolean(env.RAZORPAY_KEY_ID && env.RAZORPAY_KEY_SECRET);
export const isSmtpConfigured = Boolean(env.SMTP_HOST);
