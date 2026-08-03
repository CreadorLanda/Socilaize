-- 0018_sticker_favorites.down.sql

DROP INDEX IF EXISTS uq_sticker_packs_owner_favorites;
ALTER TABLE sticker_packs DROP COLUMN IF EXISTS is_favorites;
