import request from 'supertest';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../ai/ai.service.js', () => ({
  chat: vi.fn(),
}));

import * as aiService from '../ai/ai.service.js';
import app from '../app.js';
import pool from '../db/db.js';
import { registerAndLogin } from './helpers.js';

const mockedChat = vi.mocked(aiService.chat);

describe('Conversations', () => {
  let accessToken: string;
  let authHeader: Record<string, string>;

  beforeAll(async () => {
    const { accessToken: token } = await registerAndLogin();
    accessToken = token;
    authHeader = { Authorization: `Bearer ${accessToken}` };
  });

  beforeEach(async () => {
    await pool.query('DELETE FROM conversations');
    mockedChat.mockResolvedValue({ message: 'Done', templateHtml: '<html/>' });
  });

  async function createConversation(): Promise<string> {
    const res = await request(app)
      .post('/ai/chat')
      .set(authHeader)
      .send({ message: 'Create an invoice', model: 'deepseek-chat' });
    return res.body.conversationId as string;
  }

  describe('GET /conversations', () => {
    it('returns empty list initially', async () => {
      const res = await request(app).get('/conversations').set(authHeader);
      expect(res.status).toBe(200);
      expect(res.body).toEqual([]);
    });

    it('returns conversations after creation', async () => {
      await createConversation();
      const res = await request(app).get('/conversations').set(authHeader);
      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(1);
    });

    it('returns 401 without auth', async () => {
      const res = await request(app).get('/conversations');
      expect(res.status).toBe(401);
    });
  });

  describe('GET /conversations/:id', () => {
    it('returns conversation with messages', async () => {
      const convId = await createConversation();
      const res = await request(app).get(`/conversations/${convId}`).set(authHeader);
      expect(res.status).toBe(200);
      expect(res.body.id).toBe(convId);
      expect(res.body.messages).toHaveLength(2); // user + assistant
    });

    it('returns 404 for non-existent conversation', async () => {
      const res = await request(app)
        .get('/conversations/00000000-0000-0000-0000-000000000000')
        .set(authHeader);
      expect(res.status).toBe(404);
    });

    it("returns 404 for another user's conversation", async () => {
      const convId = await createConversation();
      const { accessToken: otherToken } = await registerAndLogin({
        name: 'Other User',
        email: 'other-conv@example.com',
        password: 'pass123456',
        turnstileToken: 'test-turnstile-token',
      });
      const res = await request(app)
        .get(`/conversations/${convId}`)
        .set({ Authorization: `Bearer ${otherToken}` });
      expect(res.status).toBe(404);
    });
  });

  describe('PATCH /conversations/:id', () => {
    it('updates the conversation title', async () => {
      const convId = await createConversation();
      const res = await request(app)
        .patch(`/conversations/${convId}`)
        .set(authHeader)
        .send({ title: 'Updated Title' });
      expect(res.status).toBe(200);
      expect(res.body.title).toBe('Updated Title');
    });
  });

  describe('DELETE /conversations/:id', () => {
    it('deletes a conversation and returns 204', async () => {
      const convId = await createConversation();
      const delRes = await request(app).delete(`/conversations/${convId}`).set(authHeader);
      expect(delRes.status).toBe(204);

      const listRes = await request(app).get('/conversations').set(authHeader);
      expect(listRes.body).toHaveLength(0);
    });

    it('returns 404 for a non-existent conversation', async () => {
      const res = await request(app)
        .delete('/conversations/00000000-0000-0000-0000-000000000000')
        .set(authHeader);
      expect(res.status).toBe(404);
    });
  });
});
