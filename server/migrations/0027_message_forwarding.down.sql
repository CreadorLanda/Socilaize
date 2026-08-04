ALTER TABLE messages
    DROP COLUMN IF EXISTS forward_count,
    DROP COLUMN IF EXISTS source_channel_id,
    DROP COLUMN IF EXISTS source_post_id;
