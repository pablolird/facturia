import request from 'supertest';
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';

import app from '../app.js';
import pool from '../db/db.js';
import { registerAndLogin } from './helpers.js';

describe('Templates', () => {
  let accessToken: string;
  let authHeader: Record<string, string>;

  beforeAll(async () => {
    const { accessToken: token } = await registerAndLogin();
    accessToken = token;
    authHeader = { Authorization: `Bearer ${accessToken}` };
  });

  beforeEach(async () => {
    await pool.query('DELETE FROM templates');
  });

  const validTemplate = {
    name: 'Invoice v1',
    html_content: '<html><body>Invoice</body></html>',
  };

  describe('GET /templates', () => {
    it('returns empty list initially', async () => {
      const res = await request(app).get('/templates').set(authHeader);
      expect(res.status).toBe(200);
      expect(res.body).toEqual([]);
    });

    it('returns 401 without auth', async () => {
      const res = await request(app).get('/templates');
      expect(res.status).toBe(401);
    });
  });

  describe('POST /templates', () => {
    it('creates and returns a template', async () => {
      const res = await request(app).post('/templates').set(authHeader).send(validTemplate);
      expect(res.status).toBe(201);
      expect(res.body).toMatchObject({ name: 'Invoice v1' });
      expect(res.body.id).toBeDefined();
    });

    it('returns 400 when html_content is missing', async () => {
      const res = await request(app)
        .post('/templates')
        .set(authHeader)
        .send({ name: 'Bad Template' });
      expect(res.status).toBe(400);
    });
  });

  describe('PATCH /templates/:id', () => {
    it('updates a template name', async () => {
      const createRes = await request(app).post('/templates').set(authHeader).send(validTemplate);
      const id = createRes.body.id as string;

      const res = await request(app)
        .patch(`/templates/${id}`)
        .set(authHeader)
        .send({ name: 'Invoice v2' });
      expect(res.status).toBe(200);
      expect(res.body.name).toBe('Invoice v2');
    });

    it("returns 404 when updating another user's template", async () => {
      const createRes = await request(app).post('/templates').set(authHeader).send(validTemplate);
      const id = createRes.body.id as string;

      const { accessToken: otherToken } = await registerAndLogin({
        name: 'Other User',
        email: 'other-tmpl@example.com',
        password: 'pass123456',
        turnstileToken: 'test-turnstile-token',
      });
      const res = await request(app)
        .patch(`/templates/${id}`)
        .set({ Authorization: `Bearer ${otherToken}` })
        .send({ name: 'Stolen' });
      expect(res.status).toBe(404);
    });
  });

  describe('DELETE /templates/:id', () => {
    it('deletes a template and returns 204', async () => {
      const createRes = await request(app).post('/templates').set(authHeader).send(validTemplate);
      const id = createRes.body.id as string;

      const delRes = await request(app).delete(`/templates/${id}`).set(authHeader);
      expect(delRes.status).toBe(204);

      const listRes = await request(app).get('/templates').set(authHeader);
      expect(listRes.body).toHaveLength(0);
    });

    it('returns 404 for a non-existent template', async () => {
      const res = await request(app)
        .delete('/templates/00000000-0000-0000-0000-000000000000')
        .set(authHeader);
      expect(res.status).toBe(404);
    });
  });
});
