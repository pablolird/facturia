import { describe, expect, it } from 'vitest';

import { canonicalEmail, trialEmailHash } from '../auth/email.js';
import pool from '../db/db.js';

describe('canonicalEmail', () => {
  it.each([
    ['Me@Example.com', 'me@example.com'],
    ['me+promo@example.com', 'me@example.com'],
    ['m.e@gmail.com', 'me@gmail.com'],
    ['M.E+trial2@googlemail.com', 'me@gmail.com'],
    ['first.last@company.com.py', 'first.last@company.com.py'],
  ])('%s -> %s', (input, expected) => {
    expect(canonicalEmail(input)).toBe(expected);
  });
});

describe('trialEmailHash', () => {
  it('matches the SQL used by the migration 009 backfill', async () => {
    for (const email of ['M.E+x@googlemail.com', 'first.last+tag@company.com.py']) {
      const { rows } = await pool.query<{ hash: string }>(
        `SELECT encode(sha256(convert_to(
           CASE WHEN domain IN ('gmail.com', 'googlemail.com')
                  THEN REPLACE(split_part(local, '+', 1), '.', '') || '@gmail.com'
                ELSE split_part(local, '+', 1) || '@' || domain END, 'UTF8')), 'hex') AS hash
         FROM (SELECT split_part(LOWER(TRIM($1)), '@', 1) AS local,
                      split_part(LOWER(TRIM($1)), '@', 2) AS domain) parts`,
        [email],
      );
      expect(rows[0]!.hash).toBe(trialEmailHash(email));
    }
  });
});
