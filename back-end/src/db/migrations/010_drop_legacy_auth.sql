-- Follow-up to 009 now that Clerk is live: refresh tokens and password hashes belonged to the
-- hand-rolled JWT auth and are no longer read or written anywhere
DROP TABLE IF EXISTS refresh_tokens;
ALTER TABLE users DROP COLUMN IF EXISTS password_hash;
