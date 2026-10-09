import cors from 'cors';
import express, { type Express, type NextFunction, type Request, type Response } from 'express';
import helmet from 'helmet';

import aiRouter from './ai/ai.router.js';
import { authenticate } from './auth/auth.middleware.js';
import conversationsRouter from './conversations/conversations.router.js';
import presetsRouter from './presets/presets.router.js';
import templatesRouter from './templates/templates.router.js';
import usersRouter from './users/users.router.js';
import webhooksRouter from './webhooks/webhooks.router.js';

const app: Express = express();

// Reverse proxies between the client and the app (Render: Cloudflare + internal LB + local
// proxy = 3), so req.ip is the connecting client
app.set('trust proxy', Number(process.env['TRUST_PROXY_HOPS'] ?? 0));

app.use(helmet());
app.use(
  cors({
    origin: process.env['CORS_ORIGIN'] ?? 'http://localhost:3001',
  }),
);
// Before the JSON parser: webhook signatures are verified against the raw body
app.use('/webhooks', webhooksRouter);
// Presets accept base64 logos up to 1.5 MB, and chat requests carry the current template with its logo
app.use(express.json({ limit: '2mb' }));

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', env: process.env['NODE_ENV'] ?? 'development' });
});

app.use('/conversations', conversationsRouter);
app.use('/presets', presetsRouter);
app.use('/templates', templatesRouter);
app.use('/ai', aiRouter);
app.use('/users', usersRouter);

app.get('/me', authenticate, (req, res) => {
  const { id, email, username, role } = req.user!;
  res.json({ user: { id, email, name: username, role } });
});

app.use((_req: Request, res: Response) => {
  res.status(404).json({ error: 'Not found' });
});

app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  console.error(err);
  res.status(500).json({ error: 'Internal server error' });
});

export default app;
