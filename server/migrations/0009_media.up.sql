-- 0009_media.up.sql
-- Uploaded media objects (images, video, audio, documents).

CREATE TABLE IF NOT EXISTS media_objects (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    kind         TEXT NOT NULL CHECK (kind IN (
                     'image', 'video', 'audio', 'document', 'other'
                 )),
    mime_type    TEXT NOT NULL,
    size_bytes   BIGINT NOT NULL DEFAULT 0,
    width        INT,
    height       INT,
    duration_ms  INT,
    original_name TEXT,
    storage_path TEXT NOT NULL,          -- relative path under MEDIA_DIR
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_media_owner_created
    ON media_objects (owner_id, created_at DESC);

COMMENT ON TABLE media_objects IS 'User-uploaded media blobs stored on disk / object storage';
