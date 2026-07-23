import request from 'supertest';
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';

import app from '../app.js';
import pool from '../db/db.js';
import { registerAndLogin } from './helpers.js';

describe('Presets', () => {
  let accessToken: string;
  let authHeader: Record<string, string>;

  beforeAll(async () => {
    const { accessToken: token } = await registerAndLogin();
    accessToken = token;
    authHeader = { Authorization: `Bearer ${accessToken}` };
  });

  beforeEach(async () => {
    await pool.query('DELETE FROM presets');
  });

  describe('GET /presets', () => {
    it('returns empty list initially', async () => {
      const res = await request(app).get('/presets').set(authHeader);
      expect(res.status).toBe(200);
      expect(res.body).toEqual([]);
    });

    it('returns 401 without auth', async () => {
      const res = await request(app).get('/presets');
      expect(res.status).toBe(401);
    });
  });

  describe('POST /presets', () => {
    it('creates and returns a preset', async () => {
      const payload = { name: 'My Company', business_name: 'ACME SA', ruc: '12345678-9' };
      const res = await request(app).post('/presets').set(authHeader).send(payload);
      expect(res.status).toBe(201);
      expect(res.body).toMatchObject({ name: 'My Company', ruc: '12345678-9' });
      expect(res.body.id).toBeDefined();
    });

    it('returns 400 if name is missing', async () => {
      const res = await request(app).post('/presets').set(authHeader).send({ ruc: '123' });
      expect(res.status).toBe(400);
    });
  });

  describe('PATCH /presets/:id', () => {
    it('updates a preset field', async () => {
      const createRes = await request(app)
        .post('/presets')
        .set(authHeader)
        .send({ name: 'Old Name' });
      const id = createRes.body.id as string;

      const res = await request(app)
        .patch(`/presets/${id}`)
        .set(authHeader)
        .send({ name: 'New Name' });
      expect(res.status).toBe(200);
      expect(res.body.name).toBe('New Name');
    });

    it("returns 404 when updating another user's preset", async () => {
      const createRes = await request(app)
        .post('/presets')
        .set(authHeader)
        .send({ name: 'Mine' });
      const id = createRes.body.id as string;

      const { accessToken: otherToken } = await registerAndLogin({
        name: 'Other User',
        email: 'other@example.com',
        password: 'pass123456',
        turnstileToken: 'test-turnstile-token',
      });
      const res = await request(app)
        .patch(`/presets/${id}`)
        .set({ Authorization: `Bearer ${otherToken}` })
        .send({ name: 'Stolen' });
      expect(res.status).toBe(404);
    });
  });

  describe('DELETE /presets/:id', () => {
    it('deletes a preset and returns 204', async () => {
      const createRes = await request(app)
        .post('/presets')
        .set(authHeader)
        .send({ name: 'To Delete' });
      const id = createRes.body.id as string;

      const delRes = await request(app).delete(`/presets/${id}`).set(authHeader);
      expect(delRes.status).toBe(204);

      const listRes = await request(app).get('/presets').set(authHeader);
      expect(listRes.body).toHaveLength(0);
    });

    it('returns 404 for a non-existent preset', async () => {
      const res = await request(app)
        .delete('/presets/00000000-0000-0000-0000-000000000000')
        .set(authHeader);
      expect(res.status).toBe(404);
    });
  });

});
