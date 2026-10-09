import request from 'supertest';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../ai/ai.service.js', () => ({
  chat: vi.fn(),
}));

import * as aiService from '../ai/ai.service.js';
import app from '../app.js';
import pool from '../db/db.js';
import { registerAndLogin, registerAndLoginAdmin } from './helpers.js';

const mockedChat = vi.mocked(aiService.chat);

describe('AI Chat', () => {
  let accessToken: string;
  let authHeader: Record<string, string>;

  beforeAll(async () => {
    const { accessToken: token } = await registerAndLoginAdmin();
    accessToken = token;
    authHeader = { Authorization: `Bearer ${accessToken}` };
  });

  beforeEach(() => {
    mockedChat.mockResolvedValue({
      message: 'Here is your template',
      templateHtml: '<html><body>Invoice</body></html>',
    });
  });

  describe('POST /ai/chat', () => {
    it('creates a new conversation and returns the AI response', async () => {
      const res = await request(app)
        .post('/ai/chat')
        .set(authHeader)
        .send({ message: 'Create an invoice', model: 'deepseek-chat' });

      expect(res.status).toBe(200);
      expect(res.body.conversationId).toBeDefined();
      expect(res.body.message).toBe('Here is your template');
      expect(res.body.templateHtml).toBe('<html><body>Invoice</body></html>');
    });

    it('continues an existing conversation', async () => {
      const first = await request(app)
        .post('/ai/chat')
        .set(authHeader)
        .send({ message: 'Create an invoice', model: 'deepseek-chat' });
      const convId = first.body.conversationId as string;

      const second = await request(app).post('/ai/chat').set(authHeader).send({
        message: 'Change the color to blue',
        model: 'deepseek-chat',
        conversationId: convId,
      });

      expect(second.status).toBe(200);
      expect(second.body.conversationId).toBe(convId);
    });

    it('persists user and assistant messages', async () => {
      const chatRes = await request(app)
        .post('/ai/chat')
        .set(authHeader)
        .send({ message: 'Create an invoice', model: 'deepseek-chat' });
      const convId = chatRes.body.conversationId as string;

      const convRes = await request(app).get(`/conversations/${convId}`).set(authHeader);
      expect(convRes.body.messages).toHaveLength(2);
      expect(convRes.body.messages[0].role).toBe('user');
      expect(convRes.body.messages[1].role).toBe('assistant');
    });

    it('returns 404 for a non-existent conversationId', async () => {
      const res = await request(app).post('/ai/chat').set(authHeader).send({
        message: 'Hello',
        model: 'deepseek-chat',
        conversationId: '00000000-0000-0000-0000-000000000000',
      });
      expect(res.status).toBe(404);
    });

    it('returns 400 for an unsupported model', async () => {
      const res = await request(app)
        .post('/ai/chat')
        .set(authHeader)
        .send({ message: 'Create an invoice', model: 'gpt-4' });
      expect(res.status).toBe(400);
    });

    it('returns 401 without auth', async () => {
      const res = await request(app)
        .post('/ai/chat')
        .send({ message: 'Create an invoice', model: 'deepseek-chat' });
      expect(res.status).toBe(401);
    });
  });

  describe('free-trial paywall', () => {
    it('allows one prompt for a regular user, then returns 402', async () => {
      const { accessToken: userToken } = await registerAndLogin({
        name: 'Trial User',
        email: 'trial@example.com',
      });
      const header = { Authorization: `Bearer ${userToken}` };
      const body = { message: 'Create an invoice', model: 'deepseek-chat' };

      const first = await request(app).post('/ai/chat').set(header).send(body);
      expect(first.status).toBe(200);

      const second = await request(app).post('/ai/chat').set(header).send(body);
      expect(second.status).toBe(402);
      expect(second.body).toEqual({ error: 'trial_exhausted' });
    });

    it('grants exactly one prompt when requests arrive concurrently', async () => {
      const { accessToken: userToken } = await registerAndLogin({
        name: 'Racing User',
        email: 'racer@example.com',
      });
      const header = { Authorization: `Bearer ${userToken}` };
      const body = { message: 'Create an invoice', model: 'deepseek-chat' };

      const responses = await Promise.all(
        Array.from({ length: 10 }, () => request(app).post('/ai/chat').set(header).send(body)),
      );
      const statuses = responses.map((r) => r.status);
      expect(statuses.filter((s) => s === 200)).toHaveLength(1);
      expect(statuses.filter((s) => s === 402)).toHaveLength(9);
    });

    it('allows only one trial per inbox across Gmail dot and +tag variants', async () => {
      const body = { message: 'Create an invoice', model: 'deepseek-chat' };
      const { accessToken: first } = await registerAndLogin({ name: 'Ana', email: 'ana.perez@gmail.com' });
      const { accessToken: alias } = await registerAndLogin({ name: 'Ana', email: 'anaperez+2@googlemail.com' });

      expect((await request(app).post('/ai/chat').set({ Authorization: `Bearer ${first}` }).send(body)).status).toBe(200);
      const res = await request(app).post('/ai/chat').set({ Authorization: `Bearer ${alias}` }).send(body);
      expect(res.status).toBe(402);
    });

    it('does not grant a new trial after deleting the account and signing up again', async () => {
      const body = { message: 'Create an invoice', model: 'deepseek-chat' };
      const user = { name: 'Returning', email: 'returning@example.com' };
      const { accessToken } = await registerAndLogin(user);
      const header = { Authorization: `Bearer ${accessToken}` };

      expect((await request(app).post('/ai/chat').set(header).send(body)).status).toBe(200);
      expect((await request(app).delete('/users/me').set(header)).status).toBe(204);

      const { accessToken: again } = await registerAndLogin(user);
      const res = await request(app).post('/ai/chat').set({ Authorization: `Bearer ${again}` }).send(body);
      expect(res.status).toBe(402);
    });

    it('does not consume the per-account counter when the inbox already claimed its trial', async () => {
      const body = { message: 'Create an invoice', model: 'deepseek-chat' };
      const { accessToken: first } = await registerAndLogin({ name: 'Bo', email: 'bo@example.com' });
      const { accessToken: second, clerkUserId } = await registerAndLogin({ name: 'Bo', email: 'bo+x@example.com' });

      await request(app).post('/ai/chat').set({ Authorization: `Bearer ${first}` }).send(body).expect(200);
      await request(app).post('/ai/chat').set({ Authorization: `Bearer ${second}` }).send(body).expect(402);
      const { rows } = await pool.query('SELECT ai_prompts_used FROM users WHERE clerk_user_id = $1', [clerkUserId]);
      expect(rows[0].ai_prompts_used).toBe(0);
    });
  });
});
