-- 0019_media_retention.down.sql

DROP INDEX IF EXISTS idx_media_pending_purge;
DROP TABLE IF EXISTS media_fetches;

ALTER TABLE media_objects
    DROP COLUMN IF EXISTS expected_recipients,
    DROP COLUMN IF EXISTS keep_forever,
    DROP COLUMN IF EXISTS purged_at,
    DROP COLUMN IF EXISTS expires_at;
