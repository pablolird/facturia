import type { UserJSON } from '@clerk/backend';
import { verifyWebhook } from '@clerk/backend/webhooks';
import type { Request, Response } from 'express';

import {
  AccountConflictError,
  deleteUserByClerkId,
  provisionUser,
  syncUserEmail,
  UnverifiedEmailError,
} from '../auth/auth.service.js';
import type { ClerkIdentity } from '../auth/auth.types.js';

function identityFromWebhook(data: UserJSON): ClerkIdentity {
  const primary = data.email_addresses.find((e) => e.id === data.primary_email_address_id);
  return {
    clerkUserId: data.id,
    email: primary?.email_address.toLowerCase() ?? null,
    emailVerified: primary?.verification?.status === 'verified',
    name: [data.first_name, data.last_name].filter(Boolean).join(' ').trim(),
  };
}

function toFetchRequest(req: Request): globalThis.Request {
  const headers = new Headers();
  for (const [key, value] of Object.entries(req.headers)) {
    if (typeof value === 'string') headers.set(key, value);
  }
  return new globalThis.Request('http://localhost/webhooks/clerk', {
    method: 'POST',
    headers,
    body: Buffer.isBuffer(req.body) ? new Uint8Array(req.body) : '',
  });
}

// Every handler is idempotent: Clerk retries deliveries, and the first authenticated request
// may already have provisioned the user before user.created arrives.
export async function clerkWebhook(req: Request, res: Response): Promise<void> {
  let evt: Awaited<ReturnType<typeof verifyWebhook>>;
  try {
    evt = await verifyWebhook(toFetchRequest(req));
  } catch {
    res.status(400).json({ error: 'Invalid webhook signature' });
    return;
  }

  try {
    switch (evt.type) {
      case 'user.created':
        await provisionUser(identityFromWebhook(evt.data));
        break;
      case 'user.updated':
        await syncUserEmail(identityFromWebhook(evt.data));
        break;
      case 'user.deleted':
        if (evt.data.id) await deleteUserByClerkId(evt.data.id);
        break;
    }
  } catch (err) {
    // Not retryable: the user is provisioned on their first verified request instead
    if (err instanceof UnverifiedEmailError || err instanceof AccountConflictError) {
      res.status(200).json({ received: true, skipped: err.message });
      return;
    }
    if (isUniqueViolation(err)) {
      console.error(`Clerk webhook ${evt.type}: email already used by another account`);
      res.status(200).json({ received: true, skipped: 'email_conflict' });
      return;
    }
    throw err;
  }

  res.status(200).json({ received: true });
}

function isUniqueViolation(err: unknown): boolean {
  return (
    typeof err === 'object' &&
    err !== null &&
    'code' in err &&
    (err as { code: unknown }).code === '23505'
  );
}
