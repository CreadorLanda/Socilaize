-- 0012_stories.up.sql
-- Ephemeral stories (24h), views, simple reactions.

CREATE TABLE IF NOT EXISTS stories (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    author_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    kind            TEXT NOT NULL CHECK (kind IN (
                        'image', 'video', 'text', 'audio'
                    )),
    caption         TEXT NOT NULL DEFAULT '',
    media_url       TEXT,                         -- /api/media/.../file or external
    accent          TEXT NOT NULL DEFAULT '#2D5BFF',
    visibility      TEXT NOT NULL DEFAULT 'contacts'
                        CHECK (visibility IN ('public', 'contacts', 'close')),
    is_anonymous    BOOLEAN NOT NULL DEFAULT FALSE,
    duration_sec    INT NOT NULL DEFAULT 5,
    expires_at      TIMESTAMPTZ NOT NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_stories_author_created
    ON stories (author_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_stories_expires
    ON stories (expires_at)
    WHERE expires_at > NOW();

CREATE TABLE IF NOT EXISTS story_views (
    story_id    UUID NOT NULL REFERENCES stories(id) ON DELETE CASCADE,
    viewer_id   UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    viewed_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (story_id, viewer_id)
);

CREATE TABLE IF NOT EXISTS story_reactions (
    story_id    UUID NOT NULL REFERENCES stories(id) ON DELETE CASCADE,
    user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    emoji       TEXT NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (story_id, user_id)
);

COMMENT ON TABLE stories IS 'Ephemeral stories, default TTL 24h';
