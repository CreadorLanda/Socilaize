-- 0017_stickers.up.sql
--
-- Sticker packs imported by users (loose .webp files or .wastickers
-- bundles they exported themselves).
--
-- The bytes live in media_objects like any other upload, so streaming,
-- ownership and cleanup already work. A sticker row is the pack-membership
-- record plus the emoji association WhatsApp-format packs carry.
--
-- Constraints mirror the published sticker format so packs stay valid for
-- interop in both directions:
--   * 512x512 WebP, <=100 KB static / <=500 KB animated
--   * tray icon 96x96, <=50 KB
--   * 3-30 stickers per pack (enforced in the service, not here, so a
--     partially-built pack can exist mid-import)

CREATE TABLE IF NOT EXISTS sticker_packs (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name          TEXT NOT NULL,
    author        TEXT NOT NULL DEFAULT '',
    -- Optional tray icon; .webp-only imports have no tray so we fall back
    -- to the first sticker on the client.
    tray_media_id UUID REFERENCES media_objects(id) ON DELETE SET NULL,
    -- Identifier from a .wastickers bundle, used to skip re-importing the
    -- same pack twice. Null for loose-file imports.
    source_id     TEXT,
    animated      BOOLEAN NOT NULL DEFAULT FALSE,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS stickers (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pack_id    UUID NOT NULL REFERENCES sticker_packs(id) ON DELETE CASCADE,
    media_id   UUID NOT NULL REFERENCES media_objects(id) ON DELETE CASCADE,
    -- Emojis this sticker answers to, as sent in the pack metadata.
    emojis     TEXT NOT NULL DEFAULT '',
    position   INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sticker_packs_owner
    ON sticker_packs (owner_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_stickers_pack_position
    ON stickers (pack_id, position);

-- Re-importing the same bundle should update, not duplicate.
CREATE UNIQUE INDEX IF NOT EXISTS uq_sticker_packs_owner_source
    ON sticker_packs (owner_id, source_id) WHERE source_id IS NOT NULL;

COMMENT ON TABLE  sticker_packs           IS 'User-imported sticker packs';
COMMENT ON COLUMN sticker_packs.source_id IS 'Identifier from an imported bundle; dedupes re-imports';
COMMENT ON COLUMN stickers.emojis         IS 'Emojis associated with the sticker in the pack metadata';
