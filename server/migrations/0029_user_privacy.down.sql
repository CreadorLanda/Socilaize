ALTER TABLE users
    DROP COLUMN IF EXISTS last_seen_visibility,
    DROP COLUMN IF EXISTS photo_visibility,
    DROP COLUMN IF EXISTS read_receipts;
