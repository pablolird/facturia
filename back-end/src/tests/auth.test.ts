import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';

import app from '../app.js';
import pool from '../db/db.js';
import { deleteClerkUser, setClerkIdentity, tokenFor } from './clerkMock.js';

const bearer = (clerkUserId: string) => ({ Authorization: `Bearer ${tokenFor(clerkUserId)}` });

describe('Auth', () => {
  beforeEach(async () => {
    await pool.query('TRUNCATE TABLE users, trial_claims RESTART IDENTITY CASCADE');
    deleteClerkUser.mockReset();
  });

  describe('session token', () => {
    it('returns 401 without an Authorization header', async () => {
      const res = await request(app).get('/me');
      expect(res.status).toBe(401);
    });

    it('returns 401 for an invalid token', async () => {
      const res = await request(app).get('/me').set('Authorization', 'Bearer forged');
      expect(res.status).toBe(401);
    });

    it('ignores a Clerk session cookie without the bearer header (CSRF)', async () => {
      const res = await request(app).get('/me').set('Cookie', `__session=${tokenFor('user_cookie')}`);
      expect(res.status).toBe(401);
    });
  });

  describe('provisioning', () => {
    it('creates the local user and demo preset on the first request', async () => {
      setClerkIdentity({ clerkUserId: 'user_new', email: 'New@Example.com', emailVerified: true, name: 'Ana Pérez' });

      const res = await request(app).get('/me').set(bearer('user_new'));
      expect(res.status).toBe(200);
      expect(res.body.user).toMatchObject({ email: 'new@example.com', name: 'Ana Pérez', role: 'user' });

      const presets = await request(app).get('/presets').set(bearer('user_new'));
      expect(presets.body).toHaveLength(1);
      expect(presets.body[0].business_name).toBe('Empresa Demo S.A.');
    });

    it('provisions exactly once under concurrent first requests', async () => {
      const responses = await Promise.all(
        Array.from({ length: 8 }, () => request(app).get('/me').set(bearer('user_racer'))),
      );
      expect(responses.every((r) => r.status === 200)).toBe(true);
      expect(new Set(responses.map((r) => r.body.user.id as string)).size).toBe(1);

      const { rows } = await pool.query(
        `SELECT COUNT(*)::int AS n FROM presets p JOIN users u ON u.id = p.user_id
         WHERE u.clerk_user_id = 'user_racer'`,
      );
      expect(rows[0].n).toBe(1);
    });

    it('returns 403 and creates nothing while the email is unverified', async () => {
      setClerkIdentity({ clerkUserId: 'user_unverified', email: 'u@example.com', emailVerified: false, name: '' });

      const res = await request(app).get('/me').set(bearer('user_unverified'));
      expect(res.status).toBe(403);
      expect(res.body).toEqual({ error: 'email_not_verified' });
      const { rowCount } = await pool.query('SELECT 1 FROM users');
      expect(rowCount).toBe(0);
    });

    it('allows two users with the same display name', async () => {
      setClerkIdentity({ clerkUserId: 'user_a', email: 'a@example.com', emailVerified: true, name: 'Juan' });
      setClerkIdentity({ clerkUserId: 'user_b', email: 'b@example.com', emailVerified: true, name: 'Juan' });
      expect((await request(app).get('/me').set(bearer('user_a'))).status).toBe(200);
      expect((await request(app).get('/me').set(bearer('user_b'))).status).toBe(200);
    });

    it('links a pre-Clerk account by verified email and keeps its data', async () => {
      const { rows } = await pool.query<{ id: string }>(
        `INSERT INTO users (username, email, password_hash) VALUES ('Legacy', 'legacy@example.com', 'x')
         RETURNING id`,
      );
      setClerkIdentity({ clerkUserId: 'user_legacy', email: 'legacy@example.com', emailVerified: true, name: 'Legacy' });

      const res = await request(app).get('/me').set(bearer('user_legacy'));
      expect(res.status).toBe(200);
      expect(res.body.user.id).toBe(rows[0]!.id);
    });

    it('returns 409 when the email already belongs to another Clerk account', async () => {
      setClerkIdentity({ clerkUserId: 'user_first', email: 'taken@example.com', emailVerified: true, name: '' });
      setClerkIdentity({ clerkUserId: 'user_second', email: 'taken@example.com', emailVerified: true, name: '' });
      await request(app).get('/me').set(bearer('user_first')).expect(200);

      const res = await request(app).get('/me').set(bearer('user_second'));
      expect(res.status).toBe(409);
    });

    it('reads the role from the database on every request', async () => {
      await request(app).get('/me').set(bearer('user_promoted')).expect(200);
      await pool.query(`UPDATE users SET role = 'admin' WHERE clerk_user_id = 'user_promoted'`);

      const res = await request(app).get('/me').set(bearer('user_promoted'));
      expect(res.body.user.role).toBe('admin');
    });
  });

  describe('DELETE /users/me', () => {
    it('deletes the Clerk user, then the local account', async () => {
      await request(app).get('/me').set(bearer('user_leaving')).expect(200);

      const res = await request(app).delete('/users/me').set(bearer('user_leaving'));
      expect(res.status).toBe(204);
      expect(deleteClerkUser).toHaveBeenCalledWith('user_leaving');
      const { rowCount } = await pool.query(`SELECT 1 FROM users WHERE clerk_user_id = 'user_leaving'`);
      expect(rowCount).toBe(0);
    });

    it('keeps the local account when deleting the Clerk user fails', async () => {
      await request(app).get('/me').set(bearer('user_stuck')).expect(200);
      deleteClerkUser.mockRejectedValueOnce(new Error('Clerk unavailable'));

      const res = await request(app).delete('/users/me').set(bearer('user_stuck'));
      expect(res.status).toBe(500);
      const { rowCount } = await pool.query(`SELECT 1 FROM users WHERE clerk_user_id = 'user_stuck'`);
      expect(rowCount).toBe(1);
    });
  });
});
