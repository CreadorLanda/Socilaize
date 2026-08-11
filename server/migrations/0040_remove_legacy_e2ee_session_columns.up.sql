-- The auth `sessions` table is the refresh-token table from 0001_auth.
-- The old messaging implementation attempted to reuse it for server-side
-- E2EE keys. Never drop this table: auth still depends on it.
ALTER TABLE sessions
    DROP COLUMN IF EXISTS session_key,
    DROP COLUMN IF EXISTS peer_id,
    DROP COLUMN IF EXISTS peer_device_id;
