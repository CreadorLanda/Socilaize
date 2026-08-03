import { api } from './client';

/**
 * Sticker packs the user imported themselves.
 *
 * Import is always user-initiated — they pick the files. There is no API
 * to read anyone's sticker library and we never look for one.
 */

// Format limits live in sticker-format (pure, no network imports) and are
// re-exported here so callers have one place to import from.
export {
  MAX_ANIMATED_BYTES,
  MAX_STATIC_BYTES,
  MAX_STICKERS,
  MAX_TRAY_BYTES,
  MIN_STICKERS,
  STICKER_DIMENSION,
  TRAY_DIMENSION,
} from '../sticker-format';

export interface StickerDTO {
  id: string;
  media_id: string;
  url: string;
  emojis?: string;
  position: number;
}

export interface StickerPackDTO {
  id: string;
  owner_id: string;
  name: string;
  author?: string;
  tray_url?: string;
  source_id?: string;
  animated: boolean;
  created_at: string;
  stickers?: StickerDTO[];
  count: number;
}

export interface StickerInput {
  media_id: string;
  emojis?: string;
}

export interface CreatePackBody {
  name: string;
  author?: string;
  tray_media_id?: string;
  source_id?: string;
  animated?: boolean;
  stickers: StickerInput[];
}

/** Per-file rejection so the UI can point at the sticker that failed. */
export interface FormatIssue {
  media_id: string;
  reason: string;
}

export function listStickerPacks() {
  return api.get<StickerPackDTO[]>('/api/stickers/packs');
}

export function getStickerPack(id: string) {
  return api.get<StickerPackDTO>(`/api/stickers/packs/${id}`);
}

export function createStickerPack(body: CreatePackBody) {
  return api.post<StickerPackDTO>('/api/stickers/packs', body);
}

/** Save one sticker to the caller's favourites pack (created on demand). */
export function saveSticker(body: { media_id: string; emojis?: string }) {
  return api.post<StickerPackDTO>('/api/stickers/favorites', body);
}

/** Remove a single sticker from one of the caller's packs. */
export function removeSticker(stickerId: string) {
  return api.del<void>(`/api/stickers/${stickerId}`);
}

export function deleteStickerPack(id: string) {
  return api.del<void>(`/api/stickers/packs/${id}`);
}
