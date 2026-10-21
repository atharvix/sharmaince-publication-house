// Prepares the isolated test database before the suite runs: applies migrations
// and seeds the fixed demo dataset the tests rely on (see tests/checkout.test.ts).
// Never touches .env / the development database.
import { config } from 'dotenv';
import { execSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { existsSync } from 'node:fs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

if (!existsSync(path.join(root, '.env.test'))) {
  console.error(
    '[setup-test-db] .env.test not found. Copy .env.test.example to .env.test ' +
      '(pointing at a dedicated test database) before running tests.',
  );
  process.exit(1);
}

config({ path: path.join(root, '.env.test') });

if (!process.env.DATABASE_URL?.includes('nightingale_test') && !process.env.ALLOW_NON_TEST_DB) {
  console.error(
    `[setup-test-db] Refusing to run: DATABASE_URL in .env.test does not look like a test database ` +
      `(${process.env.DATABASE_URL}). Set ALLOW_NON_TEST_DB=1 to override.`,
  );
  process.exit(1);
}

const env = { ...process.env };

console.log('[setup-test-db] Applying migrations to the test database...');
execSync('npx prisma migrate deploy', { cwd: root, stdio: 'inherit', env });

console.log('[setup-test-db] Seeding the test database...');
execSync('npx tsx prisma/seed.ts', { cwd: root, stdio: 'inherit', env });
