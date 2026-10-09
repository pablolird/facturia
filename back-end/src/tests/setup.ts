import { afterAll, beforeAll, vi } from 'vitest';

import pool from '../db/db.js';

vi.mock('../auth/clerk.js', () => import('./clerkMock.js'));

beforeAll(async () => {
  await pool.query(
    'TRUNCATE TABLE messages, conversations, templates, presets, users, trial_claims RESTART IDENTITY CASCADE',
  );
});

afterAll(async () => {
  await pool.end();
});
