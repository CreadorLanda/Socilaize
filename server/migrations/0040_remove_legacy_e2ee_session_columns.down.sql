-- Restore the legacy nullable shape only. Existing authentication rows remain
-- valid, and no value is fabricated. Runtime code does not use these fields.
ALTER TABLE sessions
    ADD COLUMN IF NOT EXISTS peer_id UUID,
    ADD COLUMN IF NOT EXISTS peer_device_id UUID,
    ADD COLUMN IF NOT EXISTS session_key BYTEA;
