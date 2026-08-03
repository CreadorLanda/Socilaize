-- 0017_stickers.down.sql

DROP INDEX IF EXISTS uq_sticker_packs_owner_source;
DROP INDEX IF EXISTS idx_stickers_pack_position;
DROP INDEX IF EXISTS idx_sticker_packs_owner;

DROP TABLE IF EXISTS stickers;
DROP TABLE IF EXISTS sticker_packs;
