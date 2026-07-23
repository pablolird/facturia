import request from 'supertest';

import app from '../app.js';

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
