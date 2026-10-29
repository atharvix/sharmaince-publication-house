import bcrypt from 'bcryptjs';
import { z } from 'zod';

const SALT_ROUNDS = 12;

export function hashPassword(plain: string) {
  return bcrypt.hash(plain, SALT_ROUNDS);
}

export function verifyPassword(plain: string, hash: string) {
  return bcrypt.compare(plain, hash);
}

// bcrypt silently ignores bytes past 72, so longer passwords would give a false sense of strength.
export const passwordSchema = z
  .string()
  .min(8)
  .max(72)
  .regex(/[a-z]/, 'Password must include a lowercase letter')
  .regex(/[A-Z]/, 'Password must include an uppercase letter')
  .regex(/\d/, 'Password must include a number');
