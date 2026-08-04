-- End-to-end encryption for groups, by sender keys.
--
-- Groups had no encryption at all: app/chat/[id].tsx excluded them from the
-- pairwise path outright, so every group message reached the server readable.
--
-- Pairwise X3DH does not scale to a group — encrypting each message once per
-- member means N ciphertexts per message and N sessions to keep ratcheted.
-- Instead each member holds one symmetric sender key per group, encrypts each
-- message once with it, and distributes that key to the other members over
-- the pairwise channel that already exists. The server moves ciphertext it
-- cannot read, in both directions.

-- Which generation of sender keys is current for this group.
--
-- Bumped whenever the membership changes, which is what makes removal mean
-- something: a member who leaves keeps the old key and every key distributed
-- afterwards is one they never receive.
ALTER TABLE chats ADD COLUMN key_epoch INTEGER NOT NULL DEFAULT 1;

CREATE TABLE IF NOT EXISTS group_sender_keys (
    chat_id      UUID NOT NULL REFERENCES chats(id) ON DELETE CASCADE,
    -- Whose sending key this is.
    sender_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    -- Who it is encrypted for. One row per recipient: the key is sealed to
    -- each member separately with the pairwise session.
    recipient_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    epoch        INTEGER NOT NULL,
    -- A `soc1.` envelope. The server never holds anything it can open.
    ciphertext   TEXT NOT NULL,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (chat_id, sender_id, recipient_id, epoch)
);

-- The read path: everything addressed to me in this group, oldest epoch
-- first, so history stays readable across rotations.
CREATE INDEX IF NOT EXISTS idx_group_sender_keys_recipient
    ON group_sender_keys (chat_id, recipient_id, epoch);

COMMENT ON TABLE group_sender_keys
    IS 'Sender keys sealed per recipient with the pairwise E2EE session. Opaque to the server.';
