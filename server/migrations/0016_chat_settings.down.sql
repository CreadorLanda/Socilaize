-- 0016_chat_settings.down.sql

DROP INDEX IF EXISTS idx_messages_chat_id_desc;
DROP INDEX IF EXISTS idx_chat_participants_user_pinned;

ALTER TABLE chat_participants
    DROP COLUMN IF EXISTS pinned_at,
    DROP COLUMN IF EXISTS muted_until,
    DROP COLUMN IF EXISTS archived_at,
    DROP COLUMN IF EXISTS cleared_at,
    DROP COLUMN IF EXISTS hidden_at;
