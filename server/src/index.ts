import { createApp } from './app.js';
import { env } from './env.js';
import { prisma } from './lib/prisma.js';

const app = createApp();

const server = app.listen(env.PORT, () => {
  console.log(`Nightingale Press API listening on http://localhost:${env.PORT}`);
});

server.on('error', (error: NodeJS.ErrnoException) => {
  if (error.code === 'EADDRINUSE') {
    console.error(
      `Port ${env.PORT} is already in use. Find and stop the process holding it ` +
        `(Windows: \`netstat -ano | findstr :${env.PORT}\` then \`Get-Process -Id <PID>\`; ` +
        `macOS/Linux: \`lsof -i :${env.PORT}\`), or set a different PORT in .env.`,
    );
    process.exit(1);
  }
  throw error;
});

let shuttingDown = false;
function shutdown(signal: string) {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`\n${signal} received, shutting down...`);
  server.close(async () => {
    await prisma.$disconnect();
    process.exit(0);
  });
  // Force-exit if connections don't drain in time.
  setTimeout(() => process.exit(1), 10_000).unref();
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
