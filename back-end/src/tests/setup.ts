import { afterAll, beforeAll, vi } from 'vitest';

import pool from '../db/db.js';

vi.mock('../auth/turnstile.service.js', () => ({
  verifyTurnstileToken: vi.fn().mockResolvedValue(true),
}));

beforeAll(async () => {
  await pool.query(
    'TRUNCATE TABLE messages, conversations, templates, presets, refresh_tokens, users RESTART IDENTITY CASCADE',
  );
});

afterAll(async () => {
  await pool.end();
});
