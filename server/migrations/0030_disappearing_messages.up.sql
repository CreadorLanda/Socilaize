-- Disappearing messages, timed from when they are read.
--
-- The chat screen has drawn a countdown badge from a message field since the
-- beginning and nothing ever set it: the feature existed only as a decoration.
--
-- The clock starts at the first read receipt rather than at send. A timer
-- that starts when you send punishes the recipient for being asleep — the
-- message can expire before it is ever seen, which is not privacy, it is
-- loss. Starting on read means the window is the same for everyone: as long
-- as agreed, from the moment it was actually read.
ALTER TABLE chats
    ADD COLUMN IF NOT EXISTS disappear_seconds INT NOT NULL DEFAULT 0;

-- Set on first read, not on insert. Null means "not read yet", which is why
-- it cannot double as a sent-time deadline.
ALTER TABLE messages
    ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_messages_expiring
    ON messages (expires_at) WHERE expires_at IS NOT NULL;
