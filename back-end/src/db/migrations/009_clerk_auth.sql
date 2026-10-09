-- Identity moves to Clerk. Local users keep their UUID (every other table references it) and are
-- linked to their Clerk account through clerk_user_id. Pre-Clerk users are linked on their first
-- Clerk sign-in, by verified email. This migration is additive only: the now-unused
-- refresh_tokens table and password_hash column are left in place for a later cleanup migration.
ALTER TABLE users
  ADD COLUMN clerk_user_id TEXT UNIQUE,
  ALTER COLUMN password_hash DROP NOT NULL,
  ALTER COLUMN username TYPE VARCHAR(50);

-- Display names come from Google profiles / sign-up forms now, so two users can share one
DROP INDEX IF EXISTS idx_users_username_lower;

-- One free trial per mailbox, not per account. Keyed by a SHA-256 of the canonical email (see
-- canonicalEmail in auth/email.ts) with no foreign key, so deleting the account and signing up
-- again, or using a Gmail dot / +tag variant of the same inbox, cannot claim a second trial.
CREATE TABLE trial_claims (
  email_hash CHAR(64)    PRIMARY KEY,
  claimed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Carry over trials already used before this migration. Mirrors canonicalEmail() exactly.
INSERT INTO trial_claims (email_hash)
SELECT encode(sha256(convert_to(canonical, 'UTF8')), 'hex')
FROM (
  SELECT CASE
           WHEN domain IN ('gmail.com', 'googlemail.com')
             THEN REPLACE(split_part(local, '+', 1), '.', '') || '@gmail.com'
           ELSE split_part(local, '+', 1) || '@' || domain
         END AS canonical
  FROM (
    SELECT split_part(LOWER(TRIM(email)), '@', 1) AS local,
           split_part(LOWER(TRIM(email)), '@', 2) AS domain
    FROM users
    WHERE ai_prompts_used > 0
  ) parts
) canon
ON CONFLICT DO NOTHING;
