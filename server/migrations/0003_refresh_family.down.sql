-- 0003_refresh_family.down.sql
DROP INDEX IF EXISTS idx_sessions_active;
DROP INDEX IF EXISTS idx_sessions_family;

ALTER TABLE sessions
    DROP COLUMN IF EXISTS revoked_at,
    DROP COLUMN IF EXISTS parent_id,
    DROP COLUMN IF EXISTS family_id;
