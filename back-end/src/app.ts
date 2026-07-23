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

app.use(helmet());
app.use(
  cors({
    origin: process.env['CORS_ORIGIN'] ?? 'http://localhost:3001',
    credentials: true,
  }),
);
app.use(cookieParser());
app.use(express.json());

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', env: process.env['NODE_ENV'] ?? 'development' });
});

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
