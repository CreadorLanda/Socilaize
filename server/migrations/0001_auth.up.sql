-- 0001_auth.up.sql
-- Minimum schema for the auth + device flow. Expanded by backend/auth.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS users (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    phone_hash      BYTEA UNIQUE NOT NULL,
    username        VARCHAR(50) UNIQUE NOT NULL,
    username_public BOOLEAN NOT NULL DEFAULT TRUE,
    display_name    VARCHAR(100) NOT NULL DEFAULT '',
    bio             TEXT,
    avatar_uri      TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS devices (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name            TEXT NOT NULL,
    platform        TEXT NOT NULL CHECK (platform IN ('ios','android','web','desktop')),
    push_token_enc  BYTEA,
    signal_identity BYTEA NOT NULL,
    registered_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_seen_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_devices_user ON devices(user_id);

CREATE TABLE IF NOT EXISTS sessions (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    device_id       UUID NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
    token_hash      BYTEA UNIQUE NOT NULL,
    refresh_hash    BYTEA UNIQUE NOT NULL,
    expires_at      TIMESTAMPTZ NOT NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_sessions_user_device ON sessions(user_id, device_id);
