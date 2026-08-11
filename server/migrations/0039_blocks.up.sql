-- Blocking that belongs to a person, not to a conversation.
--
-- It used to be `chats.status = 'blocked'`, set with no user_id. That made it
-- symmetric: blocking someone also stopped you writing to them, and there was
-- no way back — no unblock existed anywhere in the codebase. It also only ever
-- reached the message send path, so someone you blocked could still ring you.
--
-- A block is one person's decision about another, and it travels with them
-- rather than with any one conversation.

CREATE TABLE IF NOT EXISTS blocks (
    blocker_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    blocked_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (blocker_id, blocked_id),
    -- Blocking yourself is not a state anything should have to reason about.
    CONSTRAINT blocks_not_self CHECK (blocker_id <> blocked_id)
);

-- "Has this person blocked me" is asked on the send path and on every ring,
-- which is the direction that needs the index the current primary key does not
-- already give.
CREATE INDEX IF NOT EXISTS idx_blocks_blocked ON blocks (blocked_id);

-- Existing blocked conversations become blocks in both directions.
--
-- The old status carried no user, so which side pressed the button is not
-- recorded and cannot be recovered. Both directions is the only reading that
-- does not invent data: it reproduces exactly the effect those chats have
-- today, and each side can now lift its own half.
INSERT INTO blocks (blocker_id, blocked_id)
SELECT p1.user_id, p2.user_id
FROM chats c
JOIN chat_participants p1 ON p1.chat_id = c.id
JOIN chat_participants p2 ON p2.chat_id = c.id AND p2.user_id <> p1.user_id
WHERE c.status = 'blocked' AND c.type = 'direct'
ON CONFLICT DO NOTHING;

-- Those chats go back to being ordinary conversations. What stops the messages
-- is the blocks table now, and 'blocked' is no longer a status anything writes.
UPDATE chats SET status = 'active' WHERE status = 'blocked';

COMMENT ON TABLE blocks
    IS 'Directional. A block stops one-to-one messages and calls; groups and lives are unaffected.';
