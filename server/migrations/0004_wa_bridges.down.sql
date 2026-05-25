-- 0004_wa_bridges.down.sql
DROP INDEX IF EXISTS idx_wa_bridges_status;
DROP TABLE IF EXISTS wa_bridges;
-- Intentionally do NOT drop the whatsmeow_* tables; whatsmeow manages
-- its own schema and we'd lose linked sessions across rollbacks.
