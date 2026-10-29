import { z } from 'zod';

export const addressSchema = z.object({
  label: z.string().trim().min(1).max(60),
  fullName: z.string().trim().min(1).max(120),
  phone: z.string().trim().regex(/^\+?[\d\s-]{6,20}$/, 'Enter a valid phone number'),
  line1: z.string().trim().min(1).max(200),
  line2: z.string().trim().max(200).optional(),
  city: z.string().trim().min(1).max(100),
  state: z.string().trim().min(1).max(100),
  postalCode: z.string().trim().min(1).max(20),
  country: z.string().trim().min(1).max(100).default('India'),
});

export type AddressInput = z.infer<typeof addressSchema>;
