import 'dotenv/config';
import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import morgan from 'morgan';
import path from 'path';

import { env } from './config/env';
import { errorHandler } from './middleware/errorHandler';
import { apiLimiter } from './middleware/rateLimiter';

// ─── Route modules ────────────────────────────────────────────
import authRoutes         from './modules/auth/auth.routes';
import agencyRoutes       from './modules/agencies/agencies.routes';
import userRoutes         from './modules/users/users.routes';
import ticketRoutes       from './modules/tickets/tickets.routes';
import refundRoutes       from './modules/refunds/refunds.routes';
import transactionRoutes  from './modules/transactions/transactions.routes';
import subscriptionRoutes from './modules/subscriptions/subscriptions.routes';
import sellerRoutes       from './modules/sellers/sellers.routes';
import clientRoutes       from './modules/clients/clients.routes';
import notificationRoutes from './modules/notifications/notifications.routes';
import registrationRoutes from './modules/registrations/registrations.routes';
import apiConfigRoutes    from './modules/api-config/api-config.routes';
import reportRoutes       from './modules/reports/reports.routes';
import dashboardRoutes    from './modules/dashboard/dashboard.routes';

const app = express();

// ─── Security & parsing ───────────────────────────────────────
app.use(helmet());
app.use(
  cors({
    origin: env.CLIENT_URL,
    credentials: true,              // allow cookies (refresh token)
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  }),
);
app.use(cookieParser());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// ─── Logging ─────────────────────────────────────────────────
if (env.NODE_ENV !== 'test') {
  app.use(morgan(env.NODE_ENV === 'development' ? 'dev' : 'combined'));
}

// ─── Static uploads ───────────────────────────────────────────
app.use('/uploads', express.static(path.join(process.cwd(), env.UPLOAD_DIR)));

// ─── Health check ─────────────────────────────────────────────
app.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    env: env.NODE_ENV,
    timestamp: new Date().toISOString(),
  });
});

// ─── API routes ───────────────────────────────────────────────
const api = express.Router();
api.use(apiLimiter);

api.use('/auth',          authRoutes);
api.use('/dashboard',     dashboardRoutes);
api.use('/agencies',      agencyRoutes);
api.use('/users',         userRoutes);
api.use('/tickets',       ticketRoutes);
api.use('/refunds',       refundRoutes);
api.use('/transactions',  transactionRoutes);
api.use('/subscriptions', subscriptionRoutes);
api.use('/sellers',       sellerRoutes);
api.use('/clients',       clientRoutes);
api.use('/notifications', notificationRoutes);
api.use('/registrations', registrationRoutes);
api.use('/api-config',    apiConfigRoutes);
api.use('/reports',       reportRoutes);

app.use('/api', api);

// ─── 404 catch-all ───────────────────────────────────────────
app.use((_req, res) => {
  res.status(404).json({ success: false, message: 'Route not found' });
});

// ─── Global error handler ────────────────────────────────────
app.use(errorHandler);

// ─── Start server ─────────────────────────────────────────────
app.listen(env.PORT, () => {
  console.log(`\n🚀  Server running at http://localhost:${env.PORT}`);
  console.log(`📋  Environment : ${env.NODE_ENV}`);
  console.log(`🗄️   Database   : ${env.DATABASE_URL.split('@').pop() ?? 'connected'}`);
  console.log(`🌐  Client URL  : ${env.CLIENT_URL}\n`);
});

export default app;

