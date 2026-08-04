-- Give a device a stable identity across sign-ins.
--
-- RegisterDevice always inserted a fresh uuid, and the client sent the
-- constant string "mobile" as its name, so the server had nothing to
-- recognise a returning phone by. One real handset had accumulated 23 device
-- rows, ten of them in a single day.
--
-- That is not only clutter. A peer's pre-key bundle is chosen by
-- `ORDER BY last_seen_at DESC`, so which device answers depends on which row
-- happened to be touched last, and each new row uploads a fresh batch of
-- one-time pre-keys that nothing will ever consume — one account was holding
-- 728 of them.
ALTER TABLE devices ADD COLUMN device_key TEXT;

-- Unique per user, not globally: the key is generated on the device and two
-- users' devices have no reason to coordinate. Partial, so the rows that
-- predate this column do not collide on NULL.
CREATE UNIQUE INDEX IF NOT EXISTS devices_user_device_key
    ON devices (user_id, device_key)
 WHERE device_key IS NOT NULL;

COMMENT ON COLUMN devices.device_key
    IS 'Client-generated stable id for this installation. NULL for rows created before it existed.';
