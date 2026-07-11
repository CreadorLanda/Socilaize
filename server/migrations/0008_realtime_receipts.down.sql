-- 0008_realtime_receipts.down.sql

DROP TABLE IF EXISTS message_reactions;
DROP TABLE IF EXISTS message_receipts;

ALTER TABLE chat_participants
    DROP COLUMN IF EXISTS last_read_message_id,
    DROP COLUMN IF EXISTS last_read_at;
