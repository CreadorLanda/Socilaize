import { unzipSync } from 'fflate';

import { MAX_STICKERS } from './sticker-format';
import { validateSticker, validateTray, type WebPInfo } from './sticker-format';

/**
 * Reading a .wastickers bundle.
 *
 * Kept free of file/network imports so the parsing can be exercised
 * against a real archive without a device — the layout is not strictly
 * standardised across the apps that produce these, so it needs testing.
 */

export type ImportCandidate = {
  name: string;
  bytes: Uint8Array;
  /** Non-null once the file passes sticker validation. */
  info: WebPInfo | null;
  /** Set when the file was rejected; carries a reason key for i18n. */
  rejected?: string;
  emojis?: string;
};

export type ImportPreview = {
  packName: string;
  author: string;
  sourceId?: string;
  animated: boolean;
  stickers: ImportCandidate[];
  tray?: ImportCandidate;
  /** Files we could not use, kept so the UI can explain what was skipped. */
  rejected: ImportCandidate[];
};

export const isWebP = (n: string) => n.toLowerCase().endsWith('.webp');
export const isPNG = (n: string) => n.toLowerCase().endsWith('.png');
export const baseName = (p: string) => p.split('/').pop() ?? p;

export function previewFromBundleBytes(zipped: Uint8Array, fileName: string): ImportPreview {
  const entries = unzipSync(zipped);

  const meta = readBundleMetadata(entries);
  const stickers: ImportCandidate[] = [];
  const rejected: ImportCandidate[] = [];
  let tray: ImportCandidate | undefined;

  for (const [path, bytes] of Object.entries(entries)) {
    const name = baseName(path);
    if (!isWebP(name) && !isPNG(name)) continue;

    // The declared tray, or any 96x96 image when metadata is missing.
    if (meta.trayFile && name === baseName(meta.trayFile)) {
      const t = validateTray(bytes);
      if (t.ok) tray = { name, bytes, info: null };
      continue;
    }

    const res = validateSticker(bytes);
    if (res.ok) {
      stickers.push({
        name,
        bytes,
        info: res.info,
        emojis: meta.emojisByFile[name] ?? '',
      });
    } else if (!tray && validateTray(bytes).ok) {
      tray = { name, bytes, info: null };
    } else {
      rejected.push({ name, bytes, info: null, rejected: res.reason });
    }
  }

  // Bundles usually list stickers in a deliberate order; honour it.
  if (meta.order.length) {
    const rank = new Map(meta.order.map((n, i) => [baseName(n), i]));
    stickers.sort((a, b) => (rank.get(a.name) ?? 999) - (rank.get(b.name) ?? 999));
  }

  return {
    packName: meta.name || fileName.replace(/\.(wastickers|zip)$/i, ''),
    author: meta.publisher,
    sourceId: meta.identifier,
    animated: meta.animated || stickers.some((s) => s.info?.animated),
    stickers: stickers.slice(0, MAX_STICKERS),
    tray,
    rejected,
  };
}

type BundleMeta = {
  name: string;
  publisher: string;
  identifier?: string;
  trayFile?: string;
  animated: boolean;
  order: string[];
  emojisByFile: Record<string, string>;
};

/**
 * Bundles from different apps disagree on the metadata file, so we scan
 * every JSON entry and take the first that looks like a pack descriptor.
 * A bundle with no usable metadata still imports — we just derive
 * everything from the files.
 */
function readBundleMetadata(entries: Record<string, Uint8Array>): BundleMeta {
  const empty: BundleMeta = {
    name: '',
    publisher: '',
    animated: false,
    order: [],
    emojisByFile: {},
  };

  for (const [path, bytes] of Object.entries(entries)) {
    if (!path.toLowerCase().endsWith('.json')) continue;
    let parsed: any;
    try {
      parsed = JSON.parse(new TextDecoder().decode(bytes));
    } catch {
      continue;
    }
    // Either a bare pack object or the {sticker_packs:[…]} wrapper.
    const pack = Array.isArray(parsed?.sticker_packs) ? parsed.sticker_packs[0] : parsed;
    if (!pack || typeof pack !== 'object') continue;
    if (!pack.stickers && !pack.name && !pack.identifier) continue;

    const emojisByFile: Record<string, string> = {};
    const order: string[] = [];
    for (const s of pack.stickers ?? []) {
      const file = s?.image_file ?? s?.image ?? s?.file;
      if (typeof file !== 'string') continue;
      order.push(file);
      const emojis = Array.isArray(s?.emojis) ? s.emojis.join('') : (s?.emojis ?? '');
      if (emojis) emojisByFile[baseName(file)] = String(emojis);
    }

    return {
      name: String(pack.name ?? pack.title ?? ''),
      publisher: String(pack.publisher ?? pack.author ?? ''),
      identifier: pack.identifier ? String(pack.identifier) : undefined,
      trayFile: pack.tray_image_file ?? pack.tray_image ?? undefined,
      animated: Boolean(pack.animated_sticker_pack ?? pack.animated ?? false),
      order,
      emojisByFile,
    };
  }
  return empty;
}

