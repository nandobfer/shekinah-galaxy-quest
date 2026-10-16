import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import express, { type Request as ExpressRequest } from 'express';
import helmet from 'helmet';
import { rateLimit } from 'express-rate-limit';
import { AppModule } from './app.module.js';
import { type AppConfig } from './config.js';
import { AuthService } from './modules/auth/auth.service.js';

export async function createApp(config: AppConfig) {
  const app = await NestFactory.create(AppModule.register(config), { bodyParser: false, logger: config.NODE_ENV === 'test' ? false : ['error', 'warn', 'log'] });
  app.setGlobalPrefix('api/v1');
  app.use(helmet());
  app.use(express.json({ limit: '16kb' }));
  app.use(express.urlencoded({ extended: false, limit: '16kb' }));
  const auth = app.get(AuthService);
  const loginLimiter = rateLimit({
    windowMs: config.LOGIN_RATE_WINDOW_MS, limit: config.LOGIN_RATE_LIMIT,
    standardHeaders: 'draft-8', legacyHeaders: false,
    message: { error: { code: 'RATE_LIMITED', message: 'Muitas tentativas. Aguarde antes de tentar novamente.' } },
  });
  // Auth.js owns its protocol endpoints. No duplicate Nest routes or JWT guards.
  app.use('/api/v1/auth', (req: ExpressRequest, res: express.Response, next: express.NextFunction) => {
    // Count every mutation except logout, including alternate/trailing-slash callback paths.
    if (req.method === 'POST' && !/^\/signout\/?$/.test(req.path)) return loginLimiter(req, res, next);
    next();
  });
  app.use('/api/v1/auth', async (req: ExpressRequest, res: express.Response, next: express.NextFunction) => {
    try {
      if (!['GET', 'POST'].includes(req.method)) { res.status(405).end(); return; }
      if (req.method === 'POST' && req.headers.origin !== config.APP_ORIGIN) {
        res.status(403).json({ error: { code: 'INVALID_ORIGIN', message: 'Origem não autorizada.' } }); return;
      }
      const headers = new Headers();
      for (const key of ['cookie', 'content-type', 'x-auth-return-redirect']) {
        const value = req.headers[key];
        if (typeof value === 'string') headers.set(key, value);
      }
      // Canonical origin is configuration, never an untrusted forwarded Host.
      const url = new URL(req.originalUrl, config.APP_ORIGIN);
      const contentType = req.headers['content-type'] ?? '';
      const body = req.method === 'POST' ? (contentType.includes('application/x-www-form-urlencoded')
        ? new URLSearchParams(req.body as Record<string, string>).toString() : JSON.stringify(req.body)) : undefined;
      const response = await auth.handle(new Request(url, { method: req.method, headers, body }));
      const cookies = response.headers.getSetCookie();
      response.headers.forEach((value, key) => { if (key !== 'set-cookie') res.setHeader(key, value); });
      if (cookies.length) res.setHeader('set-cookie', cookies);
      res.setHeader('cache-control', 'no-store');
      res.status(response.status).send(await response.text());
    } catch (error) { next(error); }
  });
  app.enableShutdownHooks();
  await app.init();
  return app;
}
