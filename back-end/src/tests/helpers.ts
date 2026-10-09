import request from 'supertest';

import app from '../app.js';
import pool from '../db/db.js';
import { setClerkIdentity, tokenFor } from './clerkMock.js';

export interface TestUser {
  name: string;
  email: string;
}

export const TEST_USER: TestUser = {
  name: 'Test User',
  email: 'test@example.com',
};

// Signs a user in through the mocked Clerk session and provisions their local account (the
// first authenticated request does that, exactly like in production)
export async function registerAndLogin(user: TestUser = TEST_USER): Promise<{
  accessToken: string;
  clerkUserId: string;
}> {
  const clerkUserId = `user_${user.email.replace(/[^a-z0-9]/gi, '_')}`;
  setClerkIdentity({ clerkUserId, email: user.email, emailVerified: true, name: user.name });
  const accessToken = tokenFor(clerkUserId);
  await request(app).get('/me').set('Authorization', `Bearer ${accessToken}`).expect(200);
  return { accessToken, clerkUserId };
}

// Admins bypass the 1-prompt paywall; the role is read from the DB on every request
export async function registerAndLoginAdmin(user: TestUser = TEST_USER): Promise<{
  accessToken: string;
  clerkUserId: string;
}> {
  const session = await registerAndLogin(user);
  await pool.query(`UPDATE users SET role = 'admin' WHERE clerk_user_id = $1`, [session.clerkUserId]);
  return session;
}

export const VALID_PRESET = {
  name: 'My Company',
  business_name: 'ACME SA',
  ruc: '12345678-9',
  timbrado: '12345678',
  address: 'Av. Mariscal López 1000',
  city: 'Asunción',
  phone: '+595 21 123456',
  email: 'billing@acme.com.py',
};
