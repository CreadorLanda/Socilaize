-- 0020_view_limit.down.sql

DROP TABLE IF EXISTS message_views;
ALTER TABLE messages DROP COLUMN IF EXISTS view_limit;
