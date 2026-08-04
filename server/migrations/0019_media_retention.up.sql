-- 0019_media_retention.up.sql
--
-- Media is transient on the server, not stored indefinitely.
--
-- The rule: bytes live only long enough for every recipient to fetch them.
-- Once they all have it — or the deadline passes, whichever comes first —
-- the file is deleted from disk and the row is marked purged. The message
-- row survives so the conversation keeps its history; only the blob goes.
--
-- Two escapes from the sweep:
--   * keep_forever — set for the uploader's own copy when they have server
--     backup enabled. Nothing else opts media out.
--   * expected_recipients = 0 — media not yet attached to a message (e.g. a
--     sticker pack) is kept until its expiry, since nobody "receives" it.

ALTER TABLE media_objects
    ADD COLUMN IF NOT EXISTS expires_at    TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS purged_at     TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS keep_forever  BOOLEAN NOT NULL DEFAULT FALSE,
    -- How many people still have to fetch this before it can go. Set when
    -- the media is attached to a message.
    ADD COLUMN IF NOT EXISTS expected_recipients INT NOT NULL DEFAULT 0;

-- One row per recipient that has fetched the bytes.
CREATE TABLE IF NOT EXISTS media_fetches (
    media_id   UUID NOT NULL REFERENCES media_objects(id) ON DELETE CASCADE,
    user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    fetched_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (media_id, user_id)
);

-- The sweep scans for due rows, so index exactly that predicate.
CREATE INDEX IF NOT EXISTS idx_media_pending_purge
    ON media_objects (expires_at)
    WHERE purged_at IS NULL AND NOT keep_forever;

COMMENT ON COLUMN media_objects.expires_at
    IS 'Deadline after which the blob is deleted even if not everyone fetched it';
COMMENT ON COLUMN media_objects.purged_at
    IS 'When the bytes were deleted from storage; the row is kept as a tombstone';
COMMENT ON COLUMN media_objects.keep_forever
    IS 'Uploader has server backup enabled; exempt from the sweep';
COMMENT ON COLUMN media_objects.expected_recipients
    IS 'Recipients that must fetch before early deletion; 0 means wait for expiry';
COMMENT ON TABLE  media_fetches
    IS 'Per-recipient download confirmations that let media be purged early';
