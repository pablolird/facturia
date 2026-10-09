import { createClerkClient, type User as ClerkUser } from '@clerk/backend';

import type { ClerkIdentity } from './auth.types.js';

let client: ReturnType<typeof createClerkClient> | null = null;

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required env var: ${name}`);
  return value;
}

function clerk(): ReturnType<typeof createClerkClient> {
  client ??= createClerkClient({
    secretKey: requireEnv('CLERK_SECRET_KEY'),
    publishableKey: requireEnv('CLERK_PUBLISHABLE_KEY'),
  });
  return client;
}

// Origins allowed to mint the session tokens we accept (the token's `azp` claim). Without this
// a token issued to another site on the same Clerk instance would be accepted.
function authorizedParties(): string[] {
  return (process.env['CORS_ORIGIN'] ?? 'http://localhost:3001')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
}

// Returns the Clerk user ID for a valid, active session token, or null. Only the bearer token is
// forwarded, never cookies: the frontend reaches the API through a same-origin Vercel rewrite, so
// accepting Clerk's __session cookie here would make every endpoint CSRF-able.
export async function verifySessionToken(token: string): Promise<string | null> {
  const request = new Request('http://localhost/', {
    headers: { authorization: `Bearer ${token}` },
  });
  const state = await clerk().authenticateRequest(request, {
    acceptsToken: 'session_token',
    authorizedParties: authorizedParties(),
    ...(process.env['CLERK_JWT_KEY'] ? { jwtKey: process.env['CLERK_JWT_KEY'] } : {}),
  });
  if (!state.isAuthenticated) return null;
  return state.toAuth().userId;
}

export function toIdentity(user: Pick<
  ClerkUser,
  'emailAddresses' | 'firstName' | 'id' | 'lastName' | 'primaryEmailAddressId'
>): ClerkIdentity {
  const primary = user.emailAddresses.find((e) => e.id === user.primaryEmailAddressId);
  const name = [user.firstName, user.lastName].filter(Boolean).join(' ').trim();
  return {
    clerkUserId: user.id,
    email: primary?.emailAddress.toLowerCase() ?? null,
    emailVerified: primary?.verification?.status === 'verified',
    name,
  };
}

export async function fetchClerkIdentity(clerkUserId: string): Promise<ClerkIdentity> {
  return toIdentity(await clerk().users.getUser(clerkUserId));
}

export async function deleteClerkUser(clerkUserId: string): Promise<void> {
  await clerk().users.deleteUser(clerkUserId);
}
