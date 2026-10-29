import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import crypto from 'node:crypto';
import { pinoHttp } from 'pino-http';
import { env } from './env.js';
import { prisma } from './lib/prisma.js';
import { logger } from './lib/logger.js';
import { UPLOADS_DIR } from './lib/storage.js';
import { notFoundHandler, errorHandler } from './middleware/errorHandler.js';
import { authRouter } from './modules/auth.routes.js';
import { catalogueRouter } from './modules/catalogue.routes.js';
import { accountRouter } from './modules/account.routes.js';
import { checkoutRouter } from './modules/checkout.routes.js';
import { paymentsRouter } from './modules/payments.routes.js';
import { bulkOrdersRouter } from './modules/bulkOrders.routes.js';
import { authorApplicationsRouter } from './modules/authorApplications.routes.js';
import { contactRouter } from './modules/contact.routes.js';
import { contentRouter, adminContentRouter } from './modules/content.routes.js';
import { adminBooksRouter } from './modules/admin.books.routes.js';
import { adminUsersRouter } from './modules/admin.users.routes.js';
import { adminOrdersRouter } from './modules/admin.orders.routes.js';
import { adminPromotionsRouter } from './modules/admin.promotions.routes.js';
import { adminReportsRouter } from './modules/admin.reports.routes.js';

export function createApp() {
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', env.TRUST_PROXY);

  app.use(
    pinoHttp({
      logger,
      // Honour an upstream request id (load balancer) so logs can be correlated end to end.
      genReqId: (req, res) => {
        const incoming = req.headers['x-request-id'];
        const id = typeof incoming === 'string' && /^[\w-]{1,128}$/.test(incoming) ? incoming : crypto.randomUUID();
        res.setHeader('X-Request-Id', id);
        return id;
      },
      customLogLevel: (_req, res, err) => (err || res.statusCode >= 500 ? 'error' : res.statusCode >= 400 ? 'warn' : 'info'),
      autoLogging: { ignore: (req) => req.url === '/api/health' || req.url === '/api/ready' },
    }),
  );
  app.use(helmet());
  app.use(cors({ origin: env.CORS_ORIGIN, credentials: true }));
  app.use(compression());

  // Mounted before the global JSON body parser so the raw bytes survive for signature verification.
  app.use('/api/payments', express.raw({ type: 'application/json' }), paymentsRouter);

  app.use(express.json({ limit: '2mb' }));
  app.use(cookieParser());

  // Uploaded book covers. Relax the global same-origin CORP just for this static
  // path so the frontend (a different origin in dev) can embed the images; nothing
  // else under /uploads executes code or serves non-image content.
  app.use(
    '/uploads',
    (_req, res, next) => {
      res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
      next();
    },
    express.static(UPLOADS_DIR, { maxAge: '7d', immutable: true, index: false, dotfiles: 'deny' }),
  );

  // Liveness: the process is up. Readiness: it can also reach the database.
  app.get('/api/health', (_req, res) => res.json({ status: 'ok' }));
  app.get('/api/ready', async (_req, res) => {
    try {
      await prisma.$queryRaw`SELECT 1`;
      res.json({ status: 'ready' });
    } catch {
      res.status(503).json({ status: 'not-ready' });
    }
  });

  app.use('/api/auth', authRouter);
  app.use('/api/catalogue', catalogueRouter);
  app.use('/api/me', accountRouter);
  app.use('/api/checkout', checkoutRouter);
  app.use('/api/bulk-orders', bulkOrdersRouter);
  app.use('/api/author-applications', authorApplicationsRouter);
  app.use('/api/contact', contactRouter);
  app.use('/api/content', contentRouter);

  app.use('/api/admin/content', adminContentRouter);
  app.use('/api/admin/books', adminBooksRouter);
  app.use('/api/admin/users', adminUsersRouter);
  app.use('/api/admin/orders', adminOrdersRouter);
  app.use('/api/admin/promotions', adminPromotionsRouter);
  app.use('/api/admin/reports', adminReportsRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
