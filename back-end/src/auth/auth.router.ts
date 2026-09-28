import { isIP } from 'node:net';

import { type Request, type Router as ExpressRouter, Router } from 'express';
import { ipKeyGenerator, rateLimit } from 'express-rate-limit';

import { login, logout, refresh, register } from './auth.controller.js';

// The integration suite registers dozens of users from one IP; limits are covered by config, not tests
const skipInTests = (): boolean => process.env['NODE_ENV'] === 'test';

// Through the Vercel /api rewrite, req.ip is Vercel's egress IP and the X-Forwarded-For head is
// client-controlled; Vercel's own x-vercel-forwarded-for carries the real client IP. A caller
// bypassing Vercel can forge that header, but every login/register still needs a Turnstile token.
export function clientKey(req: Request): string {
  const vercelIp = req.headers['x-vercel-forwarded-for'];
  const ip = typeof vercelIp === 'string' && isIP(vercelIp.trim()) ? vercelIp.trim() : (req.ip ?? '');
  return ipKeyGenerator(ip);
}

const registerLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  skip: skipInTests,
  keyGenerator: clientKey,
  message: { error: 'Too many accounts created from this IP, please try again later.' },
});

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  skip: skipInTests,
  keyGenerator: clientKey,
  message: { error: 'Too many login attempts from this IP, please try again later.' },
});

const router: ExpressRouter = Router();

router.post('/register', registerLimiter, register);
router.post('/login', loginLimiter, login);
router.post('/refresh', refresh);
router.post('/logout', logout);

export default router;
