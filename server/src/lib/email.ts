import nodemailer from 'nodemailer';
import { env, isSmtpConfigured } from '../env.js';
import { logger } from './logger.js';

interface SendEmailInput {
  to: string;
  subject: string;
  html: string;
  text: string;
}

const transport = isSmtpConfigured
  ? nodemailer.createTransport({
      host: env.SMTP_HOST,
      port: env.SMTP_PORT,
      secure: env.SMTP_PORT === 465,
      auth: env.SMTP_USER ? { user: env.SMTP_USER, pass: env.SMTP_PASSWORD } : undefined,
    })
  : null;

/**
 * Sends transactional email. Without SMTP (development and tests only — env.ts requires
 * it in production) the message is logged instead so flows like password reset still work.
 */
export async function sendEmail({ to, subject, html, text }: SendEmailInput) {
  if (!transport) {
    logger.info({ to, subject, text }, 'email not sent (SMTP not configured)');
    return;
  }
  await transport.sendMail({ from: env.EMAIL_FROM, to, subject, html, text });
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
}

export function passwordResetEmail(resetUrl: string) {
  const url = escapeHtml(resetUrl);
  return {
    subject: 'Reset your Nightingale Academic Press password',
    text: `We received a request to reset your password. Use this link within 1 hour: ${resetUrl}\n\nIf you did not request this, you can safely ignore this email.`,
    html: `<p>We received a request to reset your password.</p><p><a href="${url}">Reset your password</a> (expires in 1 hour)</p><p>If you did not request this, you can safely ignore this email.</p>`,
  };
}

export function orderConfirmationEmail(orderNumber: string, totalDisplay: string, orderUrl: string) {
  const [number, total, url] = [orderNumber, totalDisplay, orderUrl].map(escapeHtml);
  return {
    subject: `Order confirmed — ${orderNumber}`,
    text: `Thank you for your order! Order ${orderNumber} for ${totalDisplay} has been confirmed. Track it here: ${orderUrl}`,
    html: `<p>Thank you for your order!</p><p>Order <strong>${number}</strong> for <strong>${total}</strong> has been confirmed.</p><p><a href="${url}">Track your order</a></p>`,
  };
}
