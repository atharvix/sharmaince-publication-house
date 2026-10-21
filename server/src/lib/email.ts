import nodemailer from 'nodemailer';
import { env, isSmtpConfigured } from '../env.js';

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
 * Sends transactional email, or logs it to the console when no SMTP provider is
 * configured — this keeps registration, password reset and order confirmation flows
 * fully testable in local/dev environments without real email credentials.
 */
export async function sendEmail({ to, subject, html, text }: SendEmailInput) {
  if (!transport) {
    console.log('\n----- DEV EMAIL (no SMTP configured) -----');
    console.log(`To: ${to}`);
    console.log(`Subject: ${subject}`);
    console.log(text);
    console.log('-------------------------------------------\n');
    return;
  }

  await transport.sendMail({ from: env.EMAIL_FROM, to, subject, html, text });
}

export function passwordResetEmail(resetUrl: string) {
  return {
    subject: 'Reset your Nightingale Academic Press password',
    text: `We received a request to reset your password. Use this link within 1 hour: ${resetUrl}\n\nIf you did not request this, you can safely ignore this email.`,
    html: `<p>We received a request to reset your password.</p><p><a href="${resetUrl}">Reset your password</a> (expires in 1 hour)</p><p>If you did not request this, you can safely ignore this email.</p>`,
  };
}

export function orderConfirmationEmail(orderNumber: string, totalDisplay: string, orderUrl: string) {
  return {
    subject: `Order confirmed — ${orderNumber}`,
    text: `Thank you for your order! Order ${orderNumber} for ${totalDisplay} has been confirmed. Track it here: ${orderUrl}`,
    html: `<p>Thank you for your order!</p><p>Order <strong>${orderNumber}</strong> for <strong>${totalDisplay}</strong> has been confirmed.</p><p><a href="${orderUrl}">Track your order</a></p>`,
  };
}
