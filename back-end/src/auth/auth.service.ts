import { randomUUID } from 'node:crypto';

import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

import pool from '../db/db.js';
import { createPreset } from '../presets/presets.service.js';
import type { InternalSession, JwtAccessPayload, JwtRefreshPayload, User } from './auth.types.js';

const ACCESS_TOKEN_EXPIRY = '15m';
const REFRESH_TOKEN_EXPIRY = '7d';
const REFRESH_TOKEN_EXPIRY_MS = 7 * 24 * 60 * 60 * 1000;

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required env var: ${name}`);
  return value;
}

export async function registerUser(
  username: string,
  email: string,
  password: string,
): Promise<User> {
  const passwordHash = await bcrypt.hash(password, 12);
  const { rows } = await pool.query<User>(
    `INSERT INTO users (username, email, password_hash)
     VALUES ($1, $2, $3)
     RETURNING id, username, email, role, created_at AS "createdAt", updated_at AS "updatedAt"`,
    [username.trim(), email.toLowerCase().trim(), passwordHash],
  );
  const user = rows[0]!;

  await createPreset(user.id, {
    name: 'Empresa Demo',
    business_name: 'Empresa Demo S.A.',
    ruc: '80000000-0',
    timbrado: '12345678',
    address: 'Av. España 123',
    city: 'Asunción',
    phone: '+595 21 000000',
    email: 'demo@empresa.com.py',
  });

  return user;
}

export async function loginUser(email: string, password: string): Promise<InternalSession | null> {
  const { rows } = await pool.query<{
    id: string;
    username: string;
    email: string;
    role: 'admin' | 'user';
    password_hash: string;
  }>('SELECT id, username, email, role, password_hash FROM users WHERE email = $1', [
    email.toLowerCase().trim(),
  ]);
  const user = rows[0];
  if (!user) return null;

  // Constant-time comparison prevents user enumeration via timing
  const valid = await bcrypt.compare(password, user.password_hash);
  if (!valid) return null;

  return issueTokenPair(user.id, user.username, user.email, user.role);
}

export async function createSessionForUser(
  userId: string,
  username: string,
  email: string,
  role: 'admin' | 'user' = 'user',
): Promise<InternalSession> {
  return issueTokenPair(userId, username, email, role);
}

export async function refreshTokens(incomingToken: string): Promise<InternalSession | null> {
  let payload: JwtRefreshPayload;
  try {
    payload = jwt.verify(incomingToken, requireEnv('JWT_REFRESH_SECRET'), {
      algorithms: ['HS256'],
    }) as JwtRefreshPayload;
  } catch {
    return null;
  }

  if (payload.type !== 'refresh') return null;

  // Rotate: delete the old token and issue a new pair (prevents replay attacks)
  const { rows } = await pool.query<{ user_id: string }>(
    `DELETE FROM refresh_tokens WHERE jti = $1 AND expires_at > NOW() RETURNING user_id`,
    [payload.jti],
  );
  if (!rows[0]) return null;

  const { rows: userRows } = await pool.query<{ username: string; email: string; role: 'admin' | 'user' }>(
    'SELECT username, email, role FROM users WHERE id = $1',
    [rows[0].user_id],
  );
  if (!userRows[0]) return null;

  return issueTokenPair(rows[0].user_id, userRows[0].username, userRows[0].email, userRows[0].role);
}

export async function revokeRefreshToken(incomingToken: string): Promise<void> {
  let payload: JwtRefreshPayload;
  try {
    payload = jwt.verify(incomingToken, requireEnv('JWT_REFRESH_SECRET'), {
      algorithms: ['HS256'],
    }) as JwtRefreshPayload;
  } catch {
    return;
  }
  await pool.query('DELETE FROM refresh_tokens WHERE jti = $1', [payload.jti]);
}

export function verifyAccessToken(token: string): JwtAccessPayload | null {
  try {
    const payload = jwt.verify(token, requireEnv('JWT_ACCESS_SECRET'), {
      algorithms: ['HS256'],
    }) as JwtAccessPayload;
    if (payload.type !== 'access') return null;
    return payload;
  } catch {
    return null;
  }
}

async function issueTokenPair(userId: string, username: string, email: string, role: 'admin' | 'user'): Promise<InternalSession> {
  const jti = randomUUID();
  const expiresAt = new Date(Date.now() + REFRESH_TOKEN_EXPIRY_MS);

  await pool.query('INSERT INTO refresh_tokens (user_id, jti, expires_at) VALUES ($1, $2, $3)', [
    userId,
    jti,
    expiresAt,
  ]);

  const accessPayload: JwtAccessPayload = { userId, username, email, role, type: 'access' };
  const refreshPayload: JwtRefreshPayload = { userId, jti, type: 'refresh' };

  const accessToken = jwt.sign(accessPayload, requireEnv('JWT_ACCESS_SECRET'), {
    expiresIn: ACCESS_TOKEN_EXPIRY,
  });

  const refreshToken = jwt.sign(refreshPayload, requireEnv('JWT_REFRESH_SECRET'), {
    expiresIn: REFRESH_TOKEN_EXPIRY,
  });

  return { accessToken, refreshToken, user: { id: userId, username, email, role } };
}
