import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import morgan from 'morgan';
import { env } from './env.js';
import { prisma } from './lib/prisma.js';
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

  app.use(helmet());
  app.use(cors({ origin: env.CORS_ORIGIN, credentials: true }));
  app.use(compression());
  if (env.NODE_ENV !== 'test') app.use(morgan(env.NODE_ENV === 'production' ? 'combined' : 'dev'));

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

  // API identification document — this is a JSON API with no server-rendered UI at `/`.
  app.get('/', (_req, res) => {
    res.json({
      name: 'nightingale-press-api',
      status: 'ok',
      docs: '/api/health for liveness, see server/API.md for the full route reference',
    });
  });

  // Liveness: the process is up and able to respond. Exposed both bare and under
  // /api so either convention works for load balancers / uptime checks.
  app.get('/health', (_req, res) => res.json({ status: 'ok' }));
  app.get('/api/health', (_req, res) => res.json({ status: 'ok' }));

  // Readiness: liveness plus a real database round-trip, without leaking connection
  // details in the response.
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
