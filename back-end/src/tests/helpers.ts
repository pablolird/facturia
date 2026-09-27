import request from 'supertest';

import app from '../app.js';
import pool from '../db/db.js';

export interface TestUser {
  name: string;
  email: string;
  password: string;
  turnstileToken: string;
}

export const TEST_USER: TestUser = {
  name: 'Test User',
  email: 'test@example.com',
  password: 'password123',
  turnstileToken: 'test-turnstile-token',
};

export async function registerAndLogin(user: TestUser = TEST_USER): Promise<{
  accessToken: string;
  agent: ReturnType<typeof request.agent>;
}> {
  const agent = request.agent(app);
  const res = await agent.post('/auth/register').send(user);
  return { accessToken: res.body.access_token as string, agent };
}

// Admins bypass the 1-prompt paywall; the role lives in the JWT, so refresh to get a token that carries it
export async function registerAndLoginAdmin(user: TestUser = TEST_USER): Promise<{
  accessToken: string;
  agent: ReturnType<typeof request.agent>;
}> {
  const { agent } = await registerAndLogin(user);
  await pool.query(`UPDATE users SET role = 'admin' WHERE email = $1`, [user.email]);
  const res = await agent.post('/auth/refresh');
  return { accessToken: res.body.access_token as string, agent };
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
