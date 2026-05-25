-- 0002_keys.up.sql
-- Pre-key bundles for X3DH session setup. The server never stores or sees
-- private material — only the public bundle clients fetch to start a new
-- Signal session with someone they haven't talked to yet.

CREATE TABLE IF NOT EXISTS identity_keys (
    user_id    UUID NOT NULL REFERENCES users(id)   ON DELETE CASCADE,
    device_id  UUID NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
    public_key BYTEA NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (user_id, device_id)
);

CREATE TABLE IF NOT EXISTS signed_pre_keys (
    user_id    UUID NOT NULL REFERENCES users(id)   ON DELETE CASCADE,
    device_id  UUID NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
    key_id     INTEGER NOT NULL,
    public_key BYTEA NOT NULL,
    signature  BYTEA NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (user_id, device_id, key_id)
);
CREATE INDEX IF NOT EXISTS idx_signed_pre_keys_latest
    ON signed_pre_keys (user_id, device_id, created_at DESC);

-- One-time pre-keys are consumed exactly once on bundle fetch. The
-- BIGSERIAL id gives us a cheap FIFO order; the UNIQUE key_id guard stops
-- a client from re-uploading the same key under the same identity.
CREATE TABLE IF NOT EXISTS one_time_pre_keys (
    id         BIGSERIAL PRIMARY KEY,
    user_id    UUID NOT NULL REFERENCES users(id)   ON DELETE CASCADE,
    device_id  UUID NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
    key_id     INTEGER NOT NULL,
    public_key BYTEA NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (user_id, device_id, key_id)
);
CREATE INDEX IF NOT EXISTS idx_otk_consume
    ON one_time_pre_keys (user_id, device_id, id);
