-- Live broadcasts.
--
-- "Live" was a colour. The hangout screen painted its background red, and the
-- channel composer could label a post as live; nothing else in the system had
-- any idea the concept existed — no table, no route, not one occurrence of
-- is_live anywhere in the server.
--
-- A live is not a call. A call is everyone publishing to everyone, and its
-- permission question is "are you in this chat". A broadcast is one person
-- publishing to an audience that cannot, and its question is "may you watch
-- this", which has a different answer for a public channel, a private one, and
-- a group.

CREATE TABLE IF NOT EXISTS lives (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    -- What it hangs off. Exactly one of these, enforced below: a live belongs
    -- to a channel (an audience of followers) or to a chat (an audience of
    -- members), and "both" has no meaning.
    channel_id  UUID REFERENCES channels(id) ON DELETE CASCADE,
    chat_id     UUID REFERENCES chats(id) ON DELETE CASCADE,
    host_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title       TEXT NOT NULL DEFAULT '',
    started_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    -- NULL means still broadcasting. The same shape as calls.ended_at, and for
    -- the same reason: it is what makes "is this joinable" a single index hit.
    ended_at    TIMESTAMPTZ,
    -- Kept because the live view of it disappears when the broadcast does, and
    -- "42 people watched" is the only number worth anything afterwards.
    peak_viewers INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT lives_one_home CHECK (
        (channel_id IS NOT NULL AND chat_id IS NULL) OR
        (channel_id IS NULL AND chat_id IS NOT NULL)
    )
);

-- Finding the running broadcast, which every viewer asks for on open.
CREATE UNIQUE INDEX IF NOT EXISTS idx_lives_running_channel
    ON lives (channel_id) WHERE ended_at IS NULL AND channel_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_lives_running_chat
    ON lives (chat_id) WHERE ended_at IS NULL AND chat_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_lives_host ON lives (host_id, started_at DESC);

-- One row per person watching.
--
-- A row rather than a counter, because a counter cannot be corrected. Someone
-- whose phone dies is still counted by a number that only goes up; a row has a
-- left_at that a sweep can fill in.
CREATE TABLE IF NOT EXISTS live_viewers (
    live_id   UUID NOT NULL REFERENCES lives(id) ON DELETE CASCADE,
    user_id   UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    left_at   TIMESTAMPTZ,
    PRIMARY KEY (live_id, user_id)
);

-- Counting who is watching right now: the number on the screen, refreshed
-- often, so it gets its own partial index.
CREATE INDEX IF NOT EXISTS idx_live_viewers_watching
    ON live_viewers (live_id) WHERE left_at IS NULL;

COMMENT ON COLUMN lives.ended_at
    IS 'NULL while still broadcasting. A live with no end is one you can still open.';
COMMENT ON COLUMN lives.peak_viewers
    IS 'Highest concurrent audience. The live count is gone once it ends; this is what remains.';
