// Creates (or promotes) an administrator account. Reads credentials from the environment
// so the password never lands in shell history:
//   ADMIN_EMAIL=you@example.com ADMIN_NAME="Your Name" ADMIN_PASSWORD=... npm run create-admin
import { PrismaClient } from '@prisma/client';
import { hashPassword, passwordSchema } from '../src/lib/password.js';
import { emailSchema } from '../src/lib/validation.js';

const prisma = new PrismaClient();

async function main() {
  const email = emailSchema.parse(process.env.ADMIN_EMAIL);
  const name = (process.env.ADMIN_NAME ?? '').trim() || 'Administrator';
  const password = passwordSchema.parse(process.env.ADMIN_PASSWORD);
  const passwordHash = await hashPassword(password);

  const user = await prisma.user.upsert({
    where: { email },
    update: { role: 'ADMIN', isActive: true, passwordHash },
    create: { email, name, role: 'ADMIN', passwordHash },
  });
  console.log(`Administrator ready: ${user.email}`);
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
