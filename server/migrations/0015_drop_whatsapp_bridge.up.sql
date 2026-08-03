-- 0015_drop_whatsapp_bridge.up.sql
--
-- Drops the WhatsApp bridge tables created in 0004 and 0005. The bridge was
-- removed because there is no lawful way to connect a personal WhatsApp
-- account: Baileys is a reverse-engineered WhatsApp Web client (against the
-- ToS), and the official Cloud API does not expose a user's own inbox.
--
-- 0004 and 0005 are intentionally left in place as applied history — never
-- delete a migration that has already run somewhere.

DROP TABLE IF EXISTS wa_messages;
DROP TABLE IF EXISTS wa_bridges;
