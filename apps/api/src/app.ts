import 'reflect-metadata';
import express from 'express';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import jwt from 'jsonwebtoken';
import Container from 'typedi';
import fs from 'node:fs/promises';
import { env } from './config/env.config';
import { sequelize } from './database/connection';
import { csrf, errors, identify } from './middlewares/http';
import { authRoutes, courseRoutes, paymentRoutes, adminRoutes } from './routes';
import { PaymentController } from './controllers/payment.controller';
import { StorageService } from './services/storage.service';
import { requireThat } from './exceptions/http.exception';
import { openapi } from './openapi';
export function createApp() {
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', env.NODE_ENV === 'production' ? 1 : false);
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          imgSrc: ["'self'", 'data:'],
          mediaSrc: ["'self'", 'https://*.digitaloceanspaces.com'],
          connectSrc: ["'self'", 'https://*.digitaloceanspaces.com'],
          frameAncestors: ["'none'"],
        },
      },
    }),
  );
  app.get('/health/live', (_req, res) => {
    res.json({ status: 'ok' });
  });
  app.get('/health/ready', async (_req, res) => {
    await sequelize.authenticate();
    res.json({ status: 'ready' });
  });
  app.post(
    '/api/v1/webhooks/stripe',
    express.raw({ type: 'application/json', limit: '1mb' }),
    new PaymentController().webhook,
  );
  app.use(express.json({ limit: '2mb' }), cookieParser(), identify);
  app.use('/api/v1', (_req, res, next) => {
    res.set('Cache-Control', 'no-store');
    next();
  });
  app.get('/api/v1/config', (_req, res) => {
    res.json({ demo_mode: env.DEMO_MODE, issuer: env.ISSUER_NAME, test_payments: !env.LIVE_PAYMENTS_ENABLED });
  });
  app.get('/api/v1/openapi.json', (_req, res) => {
    res.json(openapi);
  });
  app.get('/api/v1/assets/local', async (req, res) => {
    requireThat(env.STORAGE_DRIVER === 'local', 404, 'NOT_FOUND', '找不到檔案');
    let claim: jwt.JwtPayload;
    try {
      claim = jwt.verify(String(req.query.token), env.JWT_SECRET, {
        algorithms: ['HS256'],
        audience: 'pt-asset',
        issuer: 'pt-academy',
      }) as jwt.JwtPayload;
    } catch {
      requireThat(false, 403, 'INVALID_TOKEN', '下載連結已過期');
    }
    requireThat(claim.kind === 'asset', 403, 'INVALID_TOKEN', '下載連結無效');
    const key = String(claim.key);
    const file = Container.get(StorageService).localPath(key);
    if (key.startsWith('certificates/')) {
      const pdf = await fs.readFile(file);
      res.attachment('certificate.pdf').type('application/pdf').send(pdf);
      return;
    }
    res.sendFile(file);
  });
  app.use('/api/v1', csrf);
  app.use('/api/v1/auth', authRoutes());
  app.use('/api/v1', courseRoutes(), paymentRoutes());
  app.use('/api/v1/admin', adminRoutes());
  app.use((_req, res) => {
    res.status(404).json({ error: { code: 'NOT_FOUND', message: '找不到此頁面' } });
  });
  app.use(errors);
  return app;
}
