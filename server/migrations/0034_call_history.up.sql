-- Call history.
--
-- The call log read from bundled sample data, so it showed the same four
-- fictional calls to everyone. Nothing about a real call was recorded at all.

CREATE TABLE IF NOT EXISTS calls (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    chat_id    UUID NOT NULL REFERENCES chats(id) ON DELETE CASCADE,
    -- Who started it. Kept even after they leave: the log still says who rang.
    caller_id  UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    mode       TEXT NOT NULL CHECK (mode IN ('voice', 'video')),
    started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    -- NULL means still running. This is what lets someone who missed the ring
    -- open the app and find the call still there to join — the single most
    -- useful thing a group call log can tell you.
    ended_at   TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_calls_chat ON calls (chat_id, started_at DESC);
-- Finding the live call for a chat, which the join path asks for on every open.
CREATE INDEX IF NOT EXISTS idx_calls_running ON calls (chat_id) WHERE ended_at IS NULL;

-- One row per person the call reached.
--
-- Separate from `calls` because the same call is answered by one person and
-- missed by another, and a log that cannot say which is not a log.
CREATE TABLE IF NOT EXISTS call_participants (
    call_id   UUID NOT NULL REFERENCES calls(id) ON DELETE CASCADE,
    user_id   UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    -- Set when they actually joined. NULL while they have not.
    joined_at TIMESTAMPTZ,
    left_at   TIMESTAMPTZ,
    -- Declined explicitly, as opposed to simply never answering.
    declined  BOOLEAN NOT NULL DEFAULT FALSE,
    PRIMARY KEY (call_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_call_participants_user
    ON call_participants (user_id);

COMMENT ON COLUMN calls.ended_at
    IS 'NULL while the call is still running. "Missed" is only knowable once this is set.';
