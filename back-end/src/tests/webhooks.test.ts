import { createHmac, randomUUID } from 'node:crypto';

import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';

import app from '../app.js';
import pool from '../db/db.js';

// Signs like Clerk (Svix / Standard Webhooks): HMAC-SHA256 over "id.timestamp.body" with the
// base64 key that follows the "whsec_" prefix
function signedHeaders(body: string, secret = process.env['CLERK_WEBHOOK_SIGNING_SECRET']!) {
  const id = `msg_${randomUUID()}`;
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const key = Buffer.from(secret.replace(/^whsec_/, ''), 'base64');
  const signature = createHmac('sha256', key).update(`${id}.${timestamp}.${body}`).digest('base64');
  return {
    'content-type': 'application/json',
    'svix-id': id,
    'svix-timestamp': timestamp,
    'svix-signature': `v1,${signature}`,
  };
}

function userEvent(type: string, id: string, email: string, verified = true) {
  return JSON.stringify({
    type,
    object: 'event',
    data: {
      id,
      object: 'user',
      first_name: 'Webhook',
      last_name: 'User',
      primary_email_address_id: 'idn_1',
      email_addresses: [
        {
          id: 'idn_1',
          object: 'email_address',
          email_address: email,
          verification: { status: verified ? 'verified' : 'unverified' },
          linked_to: [],
        },
      ],
    },
  });
}

function send(body: string, headers = signedHeaders(body)) {
  return request(app).post('/webhooks/clerk').set(headers).send(body);
}

async function localUser(clerkUserId: string) {
  const { rows } = await pool.query<{ email: string; username: string }>(
    'SELECT email, username FROM users WHERE clerk_user_id = $1',
    [clerkUserId],
  );
  return rows[0];
}

describe('POST /webhooks/clerk', () => {
  beforeEach(async () => {
    await pool.query('TRUNCATE TABLE users, trial_claims RESTART IDENTITY CASCADE');
  });

  it('rejects an unsigned request', async () => {
    const body = userEvent('user.created', 'user_wh', 'wh@example.com');
    const res = await request(app).post('/webhooks/clerk').set('content-type', 'application/json').send(body);
    expect(res.status).toBe(400);
    expect(await localUser('user_wh')).toBeUndefined();
  });

  it('rejects a payload signed with another secret', async () => {
    const body = userEvent('user.created', 'user_wh', 'wh@example.com');
    const forged = signedHeaders(body, `whsec_${Buffer.from('not-the-real-secret').toString('base64')}`);
    expect((await send(body, forged)).status).toBe(400);
  });

  it('rejects a tampered body', async () => {
    const body = userEvent('user.created', 'user_wh', 'wh@example.com');
    const headers = signedHeaders(body);
    const res = await send(body.replace('wh@example.com', 'evil@example.com'), headers);
    expect(res.status).toBe(400);
  });

  it('provisions on user.created, idempotently', async () => {
    const body = userEvent('user.created', 'user_wh', 'wh@example.com');
    expect((await send(body)).status).toBe(200);
    expect((await send(body)).status).toBe(200);

    expect(await localUser('user_wh')).toEqual({ email: 'wh@example.com', username: 'Webhook User' });
    const { rows } = await pool.query(`SELECT COUNT(*)::int AS n FROM users`);
    expect(rows[0].n).toBe(1);
  });

  it('acknowledges user.created with an unverified email without provisioning', async () => {
    const res = await send(userEvent('user.created', 'user_wh', 'wh@example.com', false));
    expect(res.status).toBe(200);
    expect(await localUser('user_wh')).toBeUndefined();
  });

  it('syncs a changed primary email on user.updated', async () => {
    await send(userEvent('user.created', 'user_wh', 'old@example.com'));
    await send(userEvent('user.updated', 'user_wh', 'New@Example.com'));
    expect((await localUser('user_wh'))?.email).toBe('new@example.com');
  });

  it('deletes the local account on user.deleted', async () => {
    await send(userEvent('user.created', 'user_wh', 'wh@example.com'));
    const body = JSON.stringify({ type: 'user.deleted', object: 'event', data: { id: 'user_wh', deleted: true, object: 'user' } });
    expect((await send(body)).status).toBe(200);
    expect(await localUser('user_wh')).toBeUndefined();
  });
});
