-- 0003_refresh_family.up.sql
-- Refresh-token family tracking. Each call to /auth/verify starts a new
-- "family" of sessions. /auth/refresh rotates the family forward — a new
-- session row is created and the previous one is marked revoked. If a
-- *revoked* refresh token is presented again, the server has just seen
-- proof of theft: the entire family is killed and the user is forced to
-- re-authenticate. This is the classic replay-detection pattern.

ALTER TABLE sessions
    ADD COLUMN IF NOT EXISTS family_id  UUID,
    ADD COLUMN IF NOT EXISTS parent_id  UUID REFERENCES sessions(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS revoked_at TIMESTAMPTZ;

-- Backfill: every existing session becomes the root of its own family. New
-- sessions written after this migration will pick their own UUID up front.
UPDATE sessions
SET family_id = COALESCE(family_id, gen_random_uuid())
WHERE family_id IS NULL;

ALTER TABLE sessions
    ALTER COLUMN family_id SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_sessions_family ON sessions(family_id);
CREATE INDEX IF NOT EXISTS idx_sessions_active ON sessions(refresh_hash) WHERE revoked_at IS NULL;
