import pool from '../db/db.js';
import { trialEmailHash } from '../auth/email.js';

export async function updateUserName(userId: string, name: string): Promise<{ username: string }> {
  const { rows } = await pool.query<{ username: string }>(
    `UPDATE users SET username = $1, updated_at = NOW() WHERE id = $2 RETURNING username`,
    [name.trim(), userId],
  );
  return rows[0]!;
}

export async function deleteUser(userId: string): Promise<void> {
  await pool.query('DELETE FROM users WHERE id = $1', [userId]);
}

// Spends the single free AI prompt. Both the per-account counter and the per-mailbox claim must
// succeed atomically, so neither a second account on the same inbox nor parallel requests can
// get a second prompt. trial_claims rows outlive the account on purpose.
export async function claimFreeTrial(userId: string, email: string): Promise<boolean> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const counted = await client.query(
      `UPDATE users SET ai_prompts_used = ai_prompts_used + 1
       WHERE id = $1 AND ai_prompts_used < 1`,
      [userId],
    );
    const claimed =
      counted.rowCount === 1 &&
      (
        await client.query(
          'INSERT INTO trial_claims (email_hash) VALUES ($1) ON CONFLICT DO NOTHING',
          [trialEmailHash(email)],
        )
      ).rowCount === 1;

    await client.query(claimed ? 'COMMIT' : 'ROLLBACK');
    return claimed;
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}
