-- 0008_realtime_receipts.up.sql
-- Delivery/read receipts, per-participant last-read cursor, reactions.

ALTER TABLE chat_participants
    ADD COLUMN IF NOT EXISTS last_read_message_id BIGINT REFERENCES messages(id),
    ADD COLUMN IF NOT EXISTS last_read_at TIMESTAMPTZ;

CREATE TABLE IF NOT EXISTS message_receipts (
    message_id  BIGINT NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
    user_id     UUID   NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    status      TEXT   NOT NULL CHECK (status IN ('delivered', 'read')),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (message_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_message_receipts_user
    ON message_receipts (user_id, status);

CREATE TABLE IF NOT EXISTS message_reactions (
    message_id  BIGINT NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
    user_id     UUID   NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    emoji       TEXT   NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (message_id, user_id, emoji)
);

CREATE INDEX IF NOT EXISTS idx_message_reactions_msg
    ON message_reactions (message_id);

COMMENT ON TABLE message_receipts IS 'Per-user delivered/read status for a message';
COMMENT ON TABLE message_reactions IS 'Emoji reactions on messages';
COMMENT ON COLUMN chat_participants.last_read_message_id IS 'Highest message id this user has marked read in the chat';
