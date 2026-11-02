import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import { errorHandler } from './errorHandler.js';
import { apiLimiter } from './rateLimit.js';

// Builds the Express app: security headers, CORS, body parsers, rate limit, 404 and error responses.
// The app only passes its routes (and optionally the admin panel config).
export async function createApp({ routes, prefix = '/api', admin } = {}) {
  const app = express();

  // The admin panel goes before helmet and the body parsers: it reads form bodies itself
  // and its pages need inline scripts that helmet's default CSP would block.
  if (admin) {
    const { buildAdminRouter } = await import('@st/admin');
    const adminRouter = await buildAdminRouter(admin);
    if (adminRouter) {
      app.locals.adminPath = adminRouter.rootPath;
      app.use(adminRouter.rootPath, adminRouter);
    }
  }

  app.use(helmet());
  app.use(cors({ origin: process.env.CORS_ORIGIN ? process.env.CORS_ORIGIN.split(',').map((origin) => origin.trim()) : false }));
  app.use(morgan('dev'));
  app.use(express.json({ limit: '100kb' }));
  app.use(express.urlencoded({ extended: false, limit: '100kb' }));

  if (routes) app.use(prefix, apiLimiter, routes);

  app.use((req, res) => {
    res.status(404).json({ success: false, message: 'Route not found' });
  });

  app.use(errorHandler);

  return app;
}
