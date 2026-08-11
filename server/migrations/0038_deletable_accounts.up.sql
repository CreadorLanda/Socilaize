-- Accounts that can actually be deleted.
--
-- Thirty-eight foreign keys pointing at users carried ON DELETE CASCADE. Two
-- did not, and they are the two every real account touches:
--
--     chats.created_by    UUID NOT NULL REFERENCES users(id)
--     messages.sender_id  UUID NOT NULL REFERENCES users(id)
--
-- Both defaulted to NO ACTION, so `DELETE FROM users` was refused for anyone
-- who had ever started a conversation or sent a message. The endpoint existed,
-- returned 500, and the app navigated to onboarding anyway.
--
-- Cascading was the wrong fix: it would let someone delete their account to
-- retract every message they ever sent, from everyone else's history,
-- retroactively. The messages belong to the conversations they were sent to.
--
-- So the account goes and the attribution goes with it. The row stays, the
-- sender becomes NULL, and the reader sees "Deleted user" — which is the true
-- statement.

ALTER TABLE messages ALTER COLUMN sender_id DROP NOT NULL;
ALTER TABLE messages DROP CONSTRAINT messages_sender_id_fkey;
ALTER TABLE messages ADD CONSTRAINT messages_sender_id_fkey
    FOREIGN KEY (sender_id) REFERENCES users(id) ON DELETE SET NULL;

-- A group outlives whoever created it; the same is true of a one-to-one chat
-- whose other side left. Losing the creator must not lose the conversation.
ALTER TABLE chats ALTER COLUMN created_by DROP NOT NULL;
ALTER TABLE chats DROP CONSTRAINT chats_created_by_fkey;
ALTER TABLE chats ADD CONSTRAINT chats_created_by_fkey
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL;

COMMENT ON COLUMN messages.sender_id
    IS 'NULL when the sender deleted their account. The message stays; the attribution does not.';
COMMENT ON COLUMN chats.created_by
    IS 'NULL when the creator deleted their account. A conversation outlives whoever started it.';
