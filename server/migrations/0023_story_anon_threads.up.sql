-- Blind channel for replies to anonymous stories.
--
-- The problem it solves: a private reply to an anonymous story opens a normal
-- chat, and a chat has two named participants — so the first reply undoes the
-- anonymity the author was promised.
--
-- Here both identities are stored (delivery and moderation need them) and
-- neither is ever serialised to the other party. A thread becomes an ordinary
-- conversation only when both sides have chosen to be known.
CREATE TABLE IF NOT EXISTS story_anon_threads (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    story_id        UUID NOT NULL REFERENCES stories(id) ON DELETE CASCADE,
    author_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    sender_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    author_revealed BOOLEAN NOT NULL DEFAULT FALSE,
    sender_revealed BOOLEAN NOT NULL DEFAULT FALSE,
    -- Set by the author. The sender is never told; their messages simply
    -- stop arriving, which denies the feedback loop harassment runs on.
    blocked         BOOLEAN NOT NULL DEFAULT FALSE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_message_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    -- One thread per person per story: a sender cannot open a second one to
    -- get around a block or to flood the author's inbox with threads.
    UNIQUE (story_id, sender_id)
);

CREATE INDEX IF NOT EXISTS idx_anon_threads_author
    ON story_anon_threads (author_id, last_message_at DESC);

CREATE TABLE IF NOT EXISTS story_anon_messages (
    id          BIGSERIAL PRIMARY KEY,
    thread_id   UUID NOT NULL REFERENCES story_anon_threads(id) ON DELETE CASCADE,
    -- Which side wrote it, without naming who that is.
    from_author BOOLEAN NOT NULL,
    body        TEXT NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_anon_messages_thread
    ON story_anon_messages (thread_id, id);
