-- 0018_sticker_favorites.up.sql
--
-- "Save this sticker" needs somewhere to put a single sticker, but a
-- normal pack must hold at least 3 to stay valid for interop. The
-- favourites pack is exempt: it is personal, never exported, and grows one
-- sticker at a time.
--
-- One per user, enforced by a partial unique index rather than a separate
-- table, so the picker can render it with exactly the same query as any
-- other pack.

ALTER TABLE sticker_packs
    ADD COLUMN IF NOT EXISTS is_favorites BOOLEAN NOT NULL DEFAULT FALSE;

CREATE UNIQUE INDEX IF NOT EXISTS uq_sticker_packs_owner_favorites
    ON sticker_packs (owner_id) WHERE is_favorites;

COMMENT ON COLUMN sticker_packs.is_favorites
    IS 'The user''s saved-stickers pack; exempt from the 3-sticker minimum';
