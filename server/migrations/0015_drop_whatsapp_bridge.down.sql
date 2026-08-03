-- 0015_drop_whatsapp_bridge.down.sql
--
-- Recreates the bridge tables so `migrate down` returns the schema to its
-- 0014 shape. The application code that used them is gone, so these are
-- structural only — rolling back does not restore the bridge feature.

CREATE TABLE IF NOT EXISTS wa_bridges (
    user_id            UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    phone              TEXT NOT NULL,
    jid                TEXT,
    status             TEXT NOT NULL CHECK (status IN ('pending','linked','failed','disconnected')),
    pairing_code       TEXT,
    pairing_expires_at TIMESTAMPTZ,
    last_error         TEXT,
    linked_at          TIMESTAMPTZ,
    created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_wa_bridges_status ON wa_bridges(status);

CREATE TABLE IF NOT EXISTS wa_messages (
    id              BIGSERIAL PRIMARY KEY,
    user_id         UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    wa_message_id   TEXT        NOT NULL,
    chat_jid        TEXT        NOT NULL,
    sender_jid      TEXT        NOT NULL,
    message_type    TEXT        NOT NULL DEFAULT 'text',
    content         TEXT,
    media_url       TEXT,
    wa_timestamp    BIGINT      NOT NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT uq_wa_messages_wa_id UNIQUE (wa_message_id)
);
