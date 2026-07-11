-- 0010_groups.down.sql

ALTER TABLE chats
    DROP COLUMN IF EXISTS description,
    DROP COLUMN IF EXISTS history_enabled,
    DROP COLUMN IF EXISTS history_mode,
    DROP COLUMN IF EXISTS history_limit;

ALTER TABLE chat_participants
    DROP COLUMN IF EXISTS role;
