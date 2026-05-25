-- 0004_wa_bridges.up.sql
-- Per-user metadata for the WhatsApp bridge. The actual whatsmeow tables
-- (whatsmeow_device, whatsmeow_sessions, etc.) are managed by the
-- whatsmeow sqlstore at server startup — we don't touch them here.

CREATE TABLE IF NOT EXISTS wa_bridges (
    user_id            UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    phone              TEXT NOT NULL,                    -- E.164, may differ from the account phone
    jid                TEXT,                             -- WhatsApp JID once linking succeeds
    status             TEXT NOT NULL CHECK (status IN ('pending','linked','failed','disconnected')),
    pairing_code       TEXT,                             -- 8 chars, transient (cleared on pair success)
    pairing_expires_at TIMESTAMPTZ,                      -- when the code stops being valid (~2 min)
    last_error         TEXT,                             -- surface to the client on /status
    linked_at          TIMESTAMPTZ,
    created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_wa_bridges_status ON wa_bridges(status);
