-- 0011_notifications.up.sql
-- Push device tokens + per-user notification preferences.

CREATE TABLE IF NOT EXISTS push_devices (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    device_id    UUID NOT NULL,
    platform     TEXT NOT NULL CHECK (platform IN ('ios', 'android', 'web', 'unknown')),
    token        TEXT NOT NULL,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (user_id, device_id),
    UNIQUE (token)
);

CREATE INDEX IF NOT EXISTS idx_push_devices_user
    ON push_devices (user_id);

CREATE TABLE IF NOT EXISTS notification_prefs (
    user_id      UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    messages     BOOLEAN NOT NULL DEFAULT TRUE,
    groups       BOOLEAN NOT NULL DEFAULT TRUE,
    calls        BOOLEAN NOT NULL DEFAULT FALSE,
    stories      BOOLEAN NOT NULL DEFAULT TRUE,
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE push_devices IS 'FCM/APNs device tokens per user device';
COMMENT ON TABLE notification_prefs IS 'User notification category toggles';
