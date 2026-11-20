import { createApp } from './app.js';
import { env } from './env.js';
import { prisma } from './lib/prisma.js';
import { logger } from './lib/logger.js';
import { expireStaleOrders } from './modules/orders.service.js';

const app = createApp();

const server = app.listen(env.PORT, () => {
  logger.info({ port: env.PORT, env: env.NODE_ENV }, 'API listening');
});

// Releases stock held by abandoned checkouts. Safe with several instances: each
// cancellation is a conditional update, so only one instance wins per order.
const expiryTimer = setInterval(() => {
  expireStaleOrders().catch((error: unknown) => logger.error({ err: error }, 'order expiry run failed'));
}, 60_000);

let shuttingDown = false;
function shutdown(signal: string, exitCode = 0) {
  if (shuttingDown) return;
  shuttingDown = true;
  logger.info({ signal }, 'shutting down');
  clearInterval(expiryTimer);
  server.close(async () => {
    await prisma.$disconnect();
    process.exit(exitCode);
  });
  // Force-exit if connections don't drain in time.
  setTimeout(() => process.exit(1), 10_000).unref();
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('unhandledRejection', (reason) => {
  logger.fatal({ err: reason }, 'unhandled promise rejection');
  shutdown('unhandledRejection', 1);
});
process.on('uncaughtException', (error) => {
  logger.fatal({ err: error }, 'uncaught exception');
  shutdown('uncaughtException', 1);
});
