-- 0006_chats_messages.up.sql
--
-- Native Socialize messaging with end-to-end encryption. Every message
-- content is encrypted with AES-256-GCM before storage; the key is
-- derived from an X3DH session between sender and recipient.
--
-- Tables:
--   chats             — conversation container (direct or group)
--   chat_participants — membership
--   messages          — individual messages, content always encrypted
--   sessions          — per-(user,device) E2EE session state

CREATE TABLE IF NOT EXISTS chats (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    type            TEXT NOT NULL CHECK (type IN ('direct', 'group')),
    title           TEXT,                              -- null for 1:1 (derived from peer name)
    avatar_url      TEXT,
    created_by      UUID NOT NULL REFERENCES users(id),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS chat_participants (
    chat_id     UUID NOT NULL REFERENCES chats(id) ON DELETE CASCADE,
    user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    joined_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (chat_id, user_id)
);

CREATE TABLE IF NOT EXISTS messages (
    id              BIGSERIAL PRIMARY KEY,
    chat_id         UUID NOT NULL REFERENCES chats(id) ON DELETE CASCADE,
    sender_id       UUID NOT NULL REFERENCES users(id),
    content         TEXT NOT NULL,             -- AES-256-GCM ciphertext, hex-encoded
    message_type    TEXT NOT NULL DEFAULT 'text'
                        CHECK (message_type IN ('text','image','video','audio',
                              'document','sticker','location','contact',
                              'poll','event','system','reply')),
    reply_to_id     BIGINT REFERENCES messages(id),
    metadata        JSONB,                     -- flexible: mentions, forwarded_count, etc.
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    edited_at       TIMESTAMPTZ,
    deleted_at      TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_messages_chat_created
    ON messages(chat_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_chat_participants_user
    ON chat_participants(user_id);

-- E2EE sessions: one row per (user_id, device_id, peer_id, peer_device).
-- The session_key is the current AES-256 key derived from the X3DH
-- shared secret. Rotated periodically or on compromise.
CREATE TABLE IF NOT EXISTS sessions (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    device_id       UUID NOT NULL,
    peer_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    peer_device_id  UUID NOT NULL,
    session_key     BYTEA NOT NULL,            -- 32-byte AES-256 key
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (user_id, device_id, peer_id, peer_device_id)
);

COMMENT ON TABLE  chats          IS 'Conversation container (direct or group)';
COMMENT ON TABLE  chat_participants IS 'Membership in a chat';
COMMENT ON TABLE  messages       IS 'E2E-encrypted messages';
COMMENT ON COLUMN messages.content IS 'AES-256-GCM ciphertext as hex';
COMMENT ON TABLE  sessions       IS 'Per-peer E2EE session keys (X3DH-derived)';
