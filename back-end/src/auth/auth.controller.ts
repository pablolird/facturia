import type { CookieOptions, Request, Response } from 'express';
import { z } from 'zod';

import {
  createSessionForUser,
  loginUser,
  refreshTokens,
  registerUser,
  revokeRefreshToken,
} from './auth.service.js';
import { verifyTurnstileToken } from './turnstile.service.js';

const REFRESH_COOKIE = 'refresh_token';
const REFRESH_TOKEN_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

function refreshCookieOptions(): CookieOptions {
  return {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env['NODE_ENV'] === 'production',
    maxAge: REFRESH_TOKEN_MAX_AGE_MS,
    path: '/',
  };
}

function setRefreshCookie(res: Response, token: string): void {
  res.cookie(REFRESH_COOKIE, token, refreshCookieOptions());
}

function clearRefreshCookie(res: Response): void {
  res.clearCookie(REFRESH_COOKIE, { httpOnly: true, sameSite: 'lax', path: '/' });
}

const registerSchema = z.object({
  name: z.string().min(2, { error: 'Name must be at least 2 characters' }).max(50, { error: 'Name must be at most 50 characters' }),
  email: z.email(),
  password: z.string().min(6, { error: 'Password must be at least 6 characters' }),
});

const loginSchema = z.object({
  email: z.email(),
  password: z.string().min(1),
  turnstileToken: z.string().min(1, { error: 'Captcha verification is required' }),
});

export async function register(req: Request, res: Response): Promise<void> {
  const result = registerSchema.safeParse(req.body);
  if (!result.success) {
    res.status(400).json({ error: z.flattenError(result.error) });
    return;
  }

  const { name, email, password } = result.data;

  try {
    const user = await registerUser(name, email, password);
    const session = await createSessionForUser(user.id, user.username, user.email, user.role);
    setRefreshCookie(res, session.refreshToken);
    res.status(201).json({
      access_token: session.accessToken,
      user: { id: user.id, email: user.email, name: user.username },
    });
  } catch (err: unknown) {
    if (isUniqueViolation(err)) {
      res.status(409).json({ error: 'An account with this email already exists' });
      return;
    }
    throw err;
  }
}

export async function login(req: Request, res: Response): Promise<void> {
  const result = loginSchema.safeParse(req.body);
  if (!result.success) {
    res.status(400).json({ error: z.flattenError(result.error) });
    return;
  }

  const captchaValid = await verifyTurnstileToken(result.data.turnstileToken, req.ip);
  if (!captchaValid) {
    res.status(400).json({ error: 'Captcha verification failed' });
    return;
  }

  const session = await loginUser(result.data.email, result.data.password);
  if (!session) {
    res.status(401).json({ error: 'Invalid credentials' });
    return;
  }

  setRefreshCookie(res, session.refreshToken);
  res.json({
    access_token: session.accessToken,
    user: { id: session.user.id, email: session.user.email, name: session.user.username },
  });
}

export async function refresh(req: Request, res: Response): Promise<void> {
  const incomingToken: unknown = req.cookies[REFRESH_COOKIE];
  if (typeof incomingToken !== 'string') {
    res.status(401).json({ error: 'Missing refresh token' });
    return;
  }

  const session = await refreshTokens(incomingToken);
  if (!session) {
    clearRefreshCookie(res);
    res.status(401).json({ error: 'Invalid or expired refresh token' });
    return;
  }

  setRefreshCookie(res, session.refreshToken);
  res.json({
    access_token: session.accessToken,
    user: { id: session.user.id, email: session.user.email, name: session.user.username },
  });
}

export async function logout(req: Request, res: Response): Promise<void> {
  const incomingToken: unknown = req.cookies[REFRESH_COOKIE];
  if (typeof incomingToken === 'string') {
    await revokeRefreshToken(incomingToken);
  }
  clearRefreshCookie(res);
  res.status(204).send();
}

function isUniqueViolation(err: unknown): boolean {
  return (
    typeof err === 'object' &&
    err !== null &&
    'code' in err &&
    (err as { code: unknown }).code === '23505'
  );
}
