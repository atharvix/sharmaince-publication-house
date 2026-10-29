import { PrismaClient } from '@prisma/client';
import { env } from '../env.js';

// The URL is passed explicitly: left to itself, Prisma reads `.env` on import, which in
// tests would silently point the suite at the development database.
export const prisma = new PrismaClient({ datasourceUrl: env.DATABASE_URL });

export type Tx = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];
