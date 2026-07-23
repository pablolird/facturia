import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';

import app from '../app.js';
import pool from '../db/db.js';
import { TEST_USER } from './helpers.js';

const LOGIN_EXTRA = { turnstileToken: 'test-turnstile-token' };

describe('Auth', () => {
  beforeEach(async () => {
    await pool.query('TRUNCATE TABLE refresh_tokens, users RESTART IDENTITY CASCADE');
  });

  describe('POST /auth/register', () => {
    it('creates a user and returns access token + refresh cookie', async () => {
      const res = await request(app).post('/auth/register').send(TEST_USER);
      expect(res.status).toBe(201);
      expect(res.body).toMatchObject({
        access_token: expect.any(String),
        user: { email: TEST_USER.email, name: TEST_USER.name },
      });
      expect(res.headers['set-cookie']).toBeDefined();
    });

    it('returns 409 on duplicate email', async () => {
      await request(app).post('/auth/register').send(TEST_USER);
      const res = await request(app).post('/auth/register').send(TEST_USER);
      expect(res.status).toBe(409);
    });

    it('returns 400 on invalid input', async () => {
      const res = await request(app).post('/auth/register').send({ email: 'not-valid' });
      expect(res.status).toBe(400);
    });

    it('returns 400 without a turnstileToken', async () => {
      const { turnstileToken: _omit, ...rest } = TEST_USER;
      const res = await request(app).post('/auth/register').send(rest);
      expect(res.status).toBe(400);
    });
  });

  describe('POST /auth/login', () => {
    it('returns access token for valid credentials', async () => {
      await request(app).post('/auth/register').send(TEST_USER);
      const res = await request(app)
        .post('/auth/login')
        .send({ email: TEST_USER.email, password: TEST_USER.password, ...LOGIN_EXTRA });
      expect(res.status).toBe(200);
      expect(res.body.access_token).toBeDefined();
      expect(res.headers['set-cookie']).toBeDefined();
    });

    it('returns 401 for wrong password', async () => {
      await request(app).post('/auth/register').send(TEST_USER);
      const res = await request(app)
        .post('/auth/login')
        .send({ email: TEST_USER.email, password: 'wrongpassword', ...LOGIN_EXTRA });
      expect(res.status).toBe(401);
    });

    it('returns 401 for unknown email', async () => {
      const res = await request(app)
        .post('/auth/login')
        .send({ email: 'nobody@example.com', password: 'password123', ...LOGIN_EXTRA });
      expect(res.status).toBe(401);
    });

    it('returns 400 without a turnstileToken', async () => {
      const res = await request(app)
        .post('/auth/login')
        .send({ email: TEST_USER.email, password: TEST_USER.password });
      expect(res.status).toBe(400);
    });
  });

  describe('POST /auth/refresh', () => {
    it('issues new tokens with a valid refresh cookie', async () => {
      const agent = request.agent(app);
      await agent.post('/auth/register').send(TEST_USER);
      const res = await agent.post('/auth/refresh');
      expect(res.status).toBe(200);
      expect(res.body.access_token).toBeDefined();
    });

    it('returns 401 with no refresh cookie', async () => {
      const res = await request(app).post('/auth/refresh');
      expect(res.status).toBe(401);
    });

    it('rejects a refresh token after logout (rotation)', async () => {
      const agent = request.agent(app);
      await agent.post('/auth/register').send(TEST_USER);
      await agent.post('/auth/logout');
      const res = await agent.post('/auth/refresh');
      expect(res.status).toBe(401);
    });
  });

  describe('POST /auth/logout', () => {
    it('responds 204 and clears the cookie', async () => {
      const agent = request.agent(app);
      await agent.post('/auth/register').send(TEST_USER);
      const res = await agent.post('/auth/logout');
      expect(res.status).toBe(204);
    });
  });

  describe('GET /me', () => {
    it('returns current user with a valid access token', async () => {
      const regRes = await request(app).post('/auth/register').send(TEST_USER);
      const token = regRes.body.access_token as string;
      const res = await request(app).get('/me').set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(200);
      expect(res.body.user.email).toBe(TEST_USER.email);
    });

    it('returns 401 without a token', async () => {
      const res = await request(app).get('/me');
      expect(res.status).toBe(401);
    });
  });
});
