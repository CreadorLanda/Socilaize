-- 0013_channels.up.sql
-- Public/private channels with posts, follows, and comments.

CREATE TABLE IF NOT EXISTS channels (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id        UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name            TEXT NOT NULL,
    handle          TEXT NOT NULL,
    description     TEXT NOT NULL DEFAULT '',
    category        TEXT NOT NULL DEFAULT 'other',
    avatar_url      TEXT,
    cover_url       TEXT,
    visibility      TEXT NOT NULL DEFAULT 'public'
                        CHECK (visibility IN ('public', 'private')),
    who_can_post    TEXT NOT NULL DEFAULT 'admins'
                        CHECK (who_can_post IN ('admins', 'publishers', 'everyone')),
    comments_enabled BOOLEAN NOT NULL DEFAULT TRUE,
    allow_anon_comments BOOLEAN NOT NULL DEFAULT TRUE,
    reactions_enabled BOOLEAN NOT NULL DEFAULT TRUE,
    join_mode       TEXT NOT NULL DEFAULT 'open'
                        CHECK (join_mode IN ('open', 'request', 'invite')),
    verified        BOOLEAN NOT NULL DEFAULT FALSE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (handle)
);

CREATE INDEX IF NOT EXISTS idx_channels_category ON channels (category);
CREATE INDEX IF NOT EXISTS idx_channels_created ON channels (created_at DESC);

CREATE TABLE IF NOT EXISTS channel_members (
    channel_id  UUID NOT NULL REFERENCES channels(id) ON DELETE CASCADE,
    user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role        TEXT NOT NULL DEFAULT 'member'
                    CHECK (role IN ('owner', 'admin', 'publisher', 'member')),
    joined_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (channel_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_channel_members_user ON channel_members (user_id);

CREATE TABLE IF NOT EXISTS channel_posts (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    channel_id  UUID NOT NULL REFERENCES channels(id) ON DELETE CASCADE,
    author_id   UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    text        TEXT NOT NULL DEFAULT '',
    post_type   TEXT NOT NULL DEFAULT 'text'
                    CHECK (post_type IN ('text', 'image', 'video', 'game', 'live', 'voice')),
    media_url   TEXT,
    views       INT NOT NULL DEFAULT 0,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_channel_posts_channel
    ON channel_posts (channel_id, created_at DESC);

CREATE TABLE IF NOT EXISTS channel_post_reactions (
    post_id     UUID NOT NULL REFERENCES channel_posts(id) ON DELETE CASCADE,
    user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    emoji       TEXT NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (post_id, user_id)
);

CREATE TABLE IF NOT EXISTS channel_comments (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    post_id     UUID NOT NULL REFERENCES channel_posts(id) ON DELETE CASCADE,
    author_id   UUID REFERENCES users(id) ON DELETE SET NULL,
    text        TEXT NOT NULL,
    anonymous   BOOLEAN NOT NULL DEFAULT FALSE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_channel_comments_post
    ON channel_comments (post_id, created_at ASC);
