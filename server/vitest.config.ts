import { readFileSync } from 'node:fs';
import { parse } from 'dotenv';
import { defineConfig } from 'vitest/config';

// Loaded here, before any test imports code, so nothing (Prisma's own `.env` loading
// included) can point the suite at the development database.
const testEnv = parse(readFileSync('.env.test'));
if (!testEnv.DATABASE_URL?.includes('_test')) {
  throw new Error(`.env.test DATABASE_URL must point at a dedicated *_test database, got: ${testEnv.DATABASE_URL}`);
}

export default defineConfig({
  test: {
    env: { ...testEnv, NODE_ENV: 'test' },
    // Every file talks to the same test database; running them in parallel makes stock
    // and counter assertions race each other.
    fileParallelism: false,
  },
});
