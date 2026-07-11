-- 0005_wa_messages.up.sql
--
-- Incoming WhatsApp messages relayed by the wa-bridge sidecar. Every
-- message carries a unique WhatsApp ID (id_) so we can deduplicate —
-- Baileys may re-deliver on reconnect.
--
-- Security constraints:
--   * chat_jid and sender_jid are CHECKed against a basic JID pattern
--     so non-JID garbage is rejected at the DB level.
--   * content is limited to 64 KiB; media captions or very long texts
--     are truncated before insert.
--   * wa_message_id is UNIQUE to guarantee exactly-one delivery.
--   * user_id references users(id) ON DELETE CASCADE — removing a user
--     cleans up their bridge messages automatically.

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

    -- 1. Deduplication: WhatsApp message IDs are globally unique per
    --    recipient. The sidecar may re-emit on reconnect; this constraint
    --    makes INSERT … ON CONFLICT DO NOTHING safe.
    CONSTRAINT uq_wa_messages_wa_id UNIQUE (wa_message_id),

    -- 2. JID format guard: WhatsApp JIDs look like "55…@s.whatsapp.net"
    --    or "…@g.us" for groups. A lax but sufficient regex keeps plain
    --    SQL injections or junk out of index lookups.
    CONSTRAINT ck_wa_messages_chat_jid   CHECK (chat_jid   ~ '^[a-zA-Z0-9_.\-]+@[a-z.]+$'),
    CONSTRAINT ck_wa_messages_sender_jid  CHECK (sender_jid  ~ '^[a-zA-Z0-9_.\-]+@[a-z.]+$'),

    -- 3. Content guard: cap at 64 KB. Anything above is truncated in Go
    --    before reaching the query.
    CONSTRAINT ck_wa_messages_content_len CHECK (char_length(content) <= 65536),

    -- 4. Known message types. Rejects unknown types at the DB level.
    CONSTRAINT ck_wa_messages_type CHECK (message_type IN (
        'text','image','video','audio','document','sticker',
        'location','contact','link','system','unknown'
    ))
);

CREATE INDEX IF NOT EXISTS idx_wa_messages_user_id   ON wa_messages(user_id);
CREATE INDEX IF NOT EXISTS idx_wa_messages_chat_jid  ON wa_messages(chat_jid);
CREATE INDEX IF NOT EXISTS idx_wa_messages_created_at ON wa_messages(created_at DESC);

COMMENT ON TABLE  wa_messages IS 'Incoming WhatsApp messages from the Baileys bridge';
COMMENT ON COLUMN wa_messages.wa_message_id IS 'WhatsApp server ID; globally unique, used for dedup';
COMMENT ON COLUMN wa_messages.chat_jid IS 'JID of the conversation (user or group)';
COMMENT ON COLUMN wa_messages.sender_jid IS 'JID of the sender (may differ from chat_jid in groups)';
COMMENT ON COLUMN wa_messages.wa_timestamp IS 'Unix seconds from the WhatsApp server';
