import cookieParser from 'cookie-parser';
import cors from 'cors';
import express, { type Express, type NextFunction, type Request, type Response } from 'express';
import helmet from 'helmet';

import aiRouter from './ai/ai.router.js';
import { authenticate } from './auth/auth.middleware.js';
import authRouter from './auth/auth.router.js';
import conversationsRouter from './conversations/conversations.router.js';
import presetsRouter from './presets/presets.router.js';
import templatesRouter from './templates/templates.router.js';
import usersRouter from './users/users.router.js';

const app: Express = express();

// Number of reverse proxies in front of the app (e.g. Vercel rewrite + Render load balancer),
// so req.ip — and therefore the auth rate limiters — see the real client IP
app.set('trust proxy', Number(process.env['TRUST_PROXY_HOPS'] ?? 0));

app.use(helmet());
app.use(
  cors({
    origin: process.env['CORS_ORIGIN'] ?? 'http://localhost:3001',
    credentials: true,
  }),
);
app.use(cookieParser());
// Presets accept base64 logos up to 1.5 MB, and chat requests carry the current template with its logo
app.use(express.json({ limit: '2mb' }));

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', env: process.env['NODE_ENV'] ?? 'development' });
});

// TEMPORARY: measures the proxy chain to calibrate TRUST_PROXY_HOPS; removed right after
if (process.env['PROXY_DEBUG'] === '1') {
  app.get('/proxy-debug', (req, res) => {
    res.json({
      ip: req.ip,
      ips: req.ips,
      xff: req.headers['x-forwarded-for'],
      xRealIp: req.headers['x-real-ip'],
      xVercelForwardedFor: req.headers['x-vercel-forwarded-for'],
      cfConnectingIp: req.headers['cf-connecting-ip'],
      trueClientIp: req.headers['true-client-ip'],
      socket: req.socket.remoteAddress,
    });
  });
}

app.use('/auth', authRouter);
app.use('/conversations', conversationsRouter);
app.use('/presets', presetsRouter);
app.use('/templates', templatesRouter);
app.use('/ai', aiRouter);
app.use('/users', usersRouter);

app.get('/me', authenticate, (req, res) => {
  res.json({ user: req.user });
});

app.use((_req: Request, res: Response) => {
  res.status(404).json({ error: 'Not found' });
});

app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  console.error(err);
  res.status(500).json({ error: 'Internal server error' });
});

export default app;
