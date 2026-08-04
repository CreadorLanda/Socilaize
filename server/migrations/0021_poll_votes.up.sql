-- Poll votes live outside the message body.
--
-- Voting used to be an edit of the message that carried the poll, which the
-- server only ever allows the author to do — so voting on anyone else's poll
-- returned 403. It also could not work in principle: message bodies are
-- end-to-end encrypted, so the server cannot merge a tally into one.
--
-- Only the option id is stored. That is an opaque token chosen by the client
-- ("o0", "o1"); the server never learns the question or what any option says.
CREATE TABLE IF NOT EXISTS message_poll_votes (
    message_id BIGINT NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
    user_id    UUID   NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    option_id  TEXT   NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (message_id, user_id, option_id)
);

CREATE INDEX IF NOT EXISTS idx_poll_votes_message
    ON message_poll_votes (message_id);
