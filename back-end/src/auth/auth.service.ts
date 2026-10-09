import pool from '../db/db.js';
import { createPreset } from '../presets/presets.service.js';
import type { ClerkIdentity, User } from './auth.types.js';

const USER_COLUMNS = 'id, username, email, role';
const USERNAME_MAX = 50;

export class UnverifiedEmailError extends Error {
  constructor() {
    super('email_not_verified');
    this.name = 'UnverifiedEmailError';
  }
}

// The email belongs to a local account already linked to a different Clerk user
export class AccountConflictError extends Error {
  constructor() {
    super('account_conflict');
    this.name = 'AccountConflictError';
  }
}

export async function findUserByClerkId(clerkUserId: string): Promise<User | null> {
  const { rows } = await pool.query<User>(
    `SELECT ${USER_COLUMNS} FROM users WHERE clerk_user_id = $1`,
    [clerkUserId],
  );
  return rows[0] ?? null;
}

function displayName(identity: ClerkIdentity, email: string): string {
  const name = identity.name || email.split('@')[0]!;
  return name.slice(0, USERNAME_MAX);
}

// Creates (or links) the local user for a Clerk account. Safe to call concurrently and repeatedly:
// the first request after sign-up and the user.created webhook may race. Only verified emails are
// accepted, because the email is what ties a person to their single free trial.
export async function provisionUser(identity: ClerkIdentity): Promise<User> {
  const existing = await findUserByClerkId(identity.clerkUserId);
  if (existing) return existing;

  if (!identity.email || !identity.emailVerified) throw new UnverifiedEmailError();
  const email = identity.email.toLowerCase();

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // An account from before the Clerk migration: link it so the user keeps their data
    const linked = await client.query<User>(
      `UPDATE users SET clerk_user_id = $1, updated_at = NOW()
       WHERE email = $2 AND clerk_user_id IS NULL
       RETURNING ${USER_COLUMNS}`,
      [identity.clerkUserId, email],
    );
    if (linked.rows[0]) {
      await client.query('COMMIT');
      return linked.rows[0];
    }

    const inserted = await client.query<User>(
      `INSERT INTO users (clerk_user_id, email, username)
       VALUES ($1, $2, $3)
       ON CONFLICT DO NOTHING
       RETURNING ${USER_COLUMNS}`,
      [identity.clerkUserId, email, displayName(identity, email)],
    );
    const user = inserted.rows[0];
    if (!user) {
      // Lost a race with a concurrent provision for the same Clerk user, or the email is taken
      await client.query('ROLLBACK');
      const raced = await findUserByClerkId(identity.clerkUserId);
      if (raced) return raced;
      throw new AccountConflictError();
    }

    await createPreset(
      user.id,
      {
        name: 'Empresa Demo',
        business_name: 'Empresa Demo S.A.',
        ruc: '80000000-0',
        timbrado: '12345678',
        address: 'Av. España 123',
        city: 'Asunción',
        phone: '+595 21 000000',
        email: 'demo@empresa.com.py',
      },
      client,
    );

    await client.query('COMMIT');
    return user;
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}

// Keeps the local email in sync when the user changes their primary address in Clerk
export async function syncUserEmail(identity: ClerkIdentity): Promise<void> {
  if (!identity.email || !identity.emailVerified) return;
  await pool.query(
    `UPDATE users SET email = $1, updated_at = NOW()
     WHERE clerk_user_id = $2 AND email <> $1`,
    [identity.email.toLowerCase(), identity.clerkUserId],
  );
}

export async function deleteUserByClerkId(clerkUserId: string): Promise<void> {
  await pool.query('DELETE FROM users WHERE clerk_user_id = $1', [clerkUserId]);
}
