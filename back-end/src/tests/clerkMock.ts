import { vi } from 'vitest';

import type { ClerkIdentity } from '../auth/auth.types.js';

// Stand-in for auth/clerk.ts. Tokens look like "test-token:<clerkUserId>"; identities default to
// a verified "<clerkUserId>@example.com" unless a test registers one with setClerkIdentity().
const TOKEN_PREFIX = 'test-token:';
const identities = new Map<string, ClerkIdentity>();

export function tokenFor(clerkUserId: string): string {
  return `${TOKEN_PREFIX}${clerkUserId}`;
}

export function setClerkIdentity(identity: ClerkIdentity): void {
  identities.set(identity.clerkUserId, identity);
}

export const verifySessionToken = vi.fn(async (token: string) =>
  token.startsWith(TOKEN_PREFIX) ? token.slice(TOKEN_PREFIX.length) : null,
);

export const fetchClerkIdentity = vi.fn(
  async (clerkUserId: string): Promise<ClerkIdentity> =>
    identities.get(clerkUserId) ?? {
      clerkUserId,
      email: `${clerkUserId}@example.com`,
      emailVerified: true,
      name: 'Test User',
    },
);

export const deleteClerkUser = vi.fn(async (_clerkUserId: string) => {});
