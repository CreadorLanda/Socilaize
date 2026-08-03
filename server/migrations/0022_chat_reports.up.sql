-- User reports.
--
-- Stored rather than emailed so moderation has a queue to work from, and so
-- a repeat reporter cannot inflate the count: one open report per reporter
-- per chat, updated in place.
--
-- No message content is copied here. Bodies are end-to-end encrypted and the
-- server could not include them even if that were wanted; a moderator works
-- from the reporter's stated reason and the account history.
CREATE TABLE IF NOT EXISTS chat_reports (
    id          BIGSERIAL PRIMARY KEY,
    chat_id     UUID NOT NULL REFERENCES chats(id) ON DELETE CASCADE,
    reporter_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    reason      TEXT NOT NULL,
    note        TEXT,
    status      TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'reviewed', 'dismissed')),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (chat_id, reporter_id)
);

CREATE INDEX IF NOT EXISTS idx_chat_reports_open
    ON chat_reports (status, created_at DESC);
