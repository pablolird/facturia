import type { NextFunction, Request, Response } from 'express';

import {
  AccountConflictError,
  findUserByClerkId,
  provisionUser,
  UnverifiedEmailError,
} from './auth.service.js';
import { fetchClerkIdentity, verifySessionToken } from './clerk.js';

export async function authenticate(req: Request, res: Response, next: NextFunction): Promise<void> {
  const authHeader = req.headers['authorization'];
  if (!authHeader?.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Missing or invalid Authorization header' });
    return;
  }

  const clerkUserId = await verifySessionToken(authHeader.slice(7));
  if (!clerkUserId) {
    res.status(401).json({ error: 'Invalid or expired session token' });
    return;
  }

  try {
    // Role and email are read from the DB on every request, so changes apply immediately
    const user =
      (await findUserByClerkId(clerkUserId)) ??
      (await provisionUser(await fetchClerkIdentity(clerkUserId)));
    req.user = { ...user, clerkUserId };
    next();
  } catch (err) {
    if (err instanceof UnverifiedEmailError) {
      res.status(403).json({ error: 'email_not_verified' });
      return;
    }
    if (err instanceof AccountConflictError) {
      res.status(409).json({ error: 'account_conflict' });
      return;
    }
    next(err);
  }
}
