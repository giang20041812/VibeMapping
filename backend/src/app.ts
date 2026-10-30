import cors from 'cors';
import express from 'express';
import { rateLimit } from 'express-rate-limit';
import helmet from 'helmet';
import { env } from './config/env.js';
import { requireAuth } from './middleware/auth.js';
import { errorHandler, notFoundHandler } from './middleware/error.js';
import { accountRouter } from './modules/account/account.routes.js';
import { adminRouter } from './modules/admin/admin.routes.js';
import { rosterAccountsRouter } from './modules/class_management/roster_accounts.routes.js';
import { healthRouter } from './modules/health/health.routes.js';
import { profileRouter } from './modules/profile/profile.routes.js';

export function createApp() {
  const app = express();

  app.disable('x-powered-by');
  app.use(helmet());
  app.use(cors({ origin: env.corsOrigins, credentials: false }));
  app.use(express.json({ limit: '1mb' }));
  app.use(rateLimit({ windowMs: 60_000, limit: 300, standardHeaders: 'draft-8', legacyHeaders: false }));

  const api = express.Router();
  api.use('/health', healthRouter);

  // Mọi route bên dưới cần JWT Supabase của người dùng
  api.use(requireAuth);
  api.use('/profile', profileRouter);
  api.use('/account', accountRouter);
  api.use('/admin', adminRouter);
  api.use('/class_management/classes', rosterAccountsRouter);

  app.use('/api', api);
  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}
