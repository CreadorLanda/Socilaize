import { uploadMedia } from './api/media';
import { type CreatePackBody, type StickerInput } from './api/stickers';
import { readFileBytes, writeTempFile } from './file-bytes';
import {
  isPNG,
  previewFromBundleBytes,
  type ImportCandidate,
  type ImportPreview,
} from './sticker-bundle';
import { MAX_STICKERS, MIN_STICKERS, validateSticker } from './sticker-format';

export { previewFromBundleBytes, type ImportCandidate, type ImportPreview };

/**
 * Turning files the user picked into a sticker pack.
 *
 * Two shapes are supported:
 *   - loose .webp files, which the user selects directly
 *   - a .wastickers bundle, which is a ZIP the user exported from a
 *     sticker-maker app
 *
 * The bundle layout is not strictly standardised across the apps that
 * produce it, so metadata is read defensively and we fall back to deriving
 * the pack from the files themselves rather than failing the import.
 */




/** Build a preview from loose files the user picked. */
export async function previewFromFiles(
  files: { uri: string; name: string }[],
): Promise<ImportPreview> {
  const stickers: ImportCandidate[] = [];
  const rejected: ImportCandidate[] = [];

  for (const f of files) {
    const bytes = await readFileBytes(f.uri);
    const candidate: ImportCandidate = { name: f.name, bytes, info: null };
    const res = validateSticker(bytes);
    if (res.ok) {
      candidate.info = res.info;
      stickers.push(candidate);
    } else {
      candidate.rejected = res.reason;
      rejected.push(candidate);
    }
  }

  return {
    packName: '',
    author: '',
    animated: stickers.some((s) => s.info?.animated),
    stickers: stickers.slice(0, MAX_STICKERS),
    rejected,
  };
}

/** Build a preview from a .wastickers / .zip bundle on disk. */
export async function previewFromBundle(uri: string, fileName: string): Promise<ImportPreview> {
  return previewFromBundleBytes(await readFileBytes(uri), fileName);
}

export type UploadProgress = (done: number, total: number) => void;

/**
 * Upload every accepted file, then create the pack. Uploads run one at a
 * time on purpose: a pack is up to 30 files and firing them all at once
 * makes a phone on mobile data time out.
 */
export async function commitImport(
  preview: ImportPreview,
  packName: string,
  onProgress?: UploadProgress,
): Promise<CreatePackBody> {
  if (preview.stickers.length < MIN_STICKERS) {
    throw new Error('too_few_stickers');
  }

  const total = preview.stickers.length + (preview.tray ? 1 : 0);
  let done = 0;

  const stickers: StickerInput[] = [];
  for (const s of preview.stickers) {
    const uri = await writeTempFile(s.name, s.bytes);
    const media = await uploadMedia({ uri, name: s.name, mimeType: 'image/webp' });
    stickers.push({ media_id: media.id, emojis: s.emojis });
    onProgress?.(++done, total);
  }

  let trayId: string | undefined;
  if (preview.tray) {
    const uri = await writeTempFile(preview.tray.name, preview.tray.bytes);
    const mime = isPNG(preview.tray.name) ? 'image/png' : 'image/webp';
    const media = await uploadMedia({ uri, name: preview.tray.name, mimeType: mime });
    trayId = media.id;
    onProgress?.(++done, total);
  }

  return {
    name: packName.trim() || preview.packName || 'Stickers',
    author: preview.author,
    tray_media_id: trayId,
    source_id: preview.sourceId,
    animated: preview.animated,
    stickers,
  };
}
