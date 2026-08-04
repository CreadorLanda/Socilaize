import { StorageAccessFramework as SAF } from 'expo-file-system/legacy';
import * as FileSystem from 'expo-file-system/legacy';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

import { MAX_STICKERS, validateSticker } from './sticker-format';
import type { ImportCandidate, ImportPreview } from './sticker-bundle';

/**
 * Bulk import from a folder the user grants once.
 *
 * There is no way to read another app's sticker library programmatically,
 * and we would not want one — that is the same "reach into someone else's
 * data" pattern the WhatsApp bridge was removed for. What Android does
 * allow is the Storage Access Framework: the user picks a folder, grants
 * access, and that grant persists. After the first tap, re-scanning needs
 * no further prompt.
 *
 * iOS has no equivalent: apps are sandboxed and cannot see another app's
 * files at all, so this whole path is Android-only.
 */

const GRANT_KEY = 'stickers.folder.v1';

/**
 * Where WhatsApp keeps downloaded stickers on Android. Used only to point
 * the system folder picker at a sensible starting place — the user still
 * has to approve it, and newer Android versions may refuse to seed here,
 * in which case the picker simply opens at the default location.
 */
const WA_STICKERS_HINT =
  'content://com.android.externalstorage.documents/document/' +
  encodeURIComponent('primary:Android/media/com.whatsapp/WhatsApp/Media/WhatsApp Stickers');

export const folderImportSupported = Platform.OS === 'android';

/** A previously granted folder, if the user already picked one. */
export async function savedFolder(): Promise<string | null> {
  try {
    return await SecureStore.getItemAsync(GRANT_KEY);
  } catch {
    return null;
  }
}

/**
 * Ask for a folder. Returns its URI, or null if the user backed out.
 * `seedWhatsApp` starts the picker at WhatsApp's sticker directory.
 */
export async function requestFolder(seedWhatsApp = true): Promise<string | null> {
  if (!folderImportSupported) return null;
  try {
    const perm = await SAF.requestDirectoryPermissionsAsync(
      seedWhatsApp ? WA_STICKERS_HINT : undefined,
    );
    if (!perm.granted) return null;
    await SecureStore.setItemAsync(GRANT_KEY, perm.directoryUri).catch(() => {});
    return perm.directoryUri;
  } catch {
    // Some OEM pickers reject a seeded URI outright; retry unseeded once.
    if (seedWhatsApp) return requestFolder(false);
    return null;
  }
}

export async function forgetFolder(): Promise<void> {
  await SecureStore.deleteItemAsync(GRANT_KEY).catch(() => {});
}

function base64ToBytes(b64: string): Uint8Array {
  const bin = global.atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

/**
 * Read every sticker in a granted folder. Files that are not valid
 * stickers are reported rather than silently dropped, so the user can see
 * why a folder yielded fewer than expected.
 */
export async function scanFolder(
  directoryUri: string,
  onProgress?: (done: number, total: number) => void,
): Promise<ImportPreview> {
  const entries = await SAF.readDirectoryAsync(directoryUri);
  const webps = entries.filter((u) => u.toLowerCase().includes('.webp'));

  const stickers: ImportCandidate[] = [];
  const rejected: ImportCandidate[] = [];

  for (let i = 0; i < webps.length; i++) {
    const uri = webps[i];
    onProgress?.(i + 1, webps.length);
    try {
      const b64 = await FileSystem.readAsStringAsync(uri, {
        encoding: FileSystem.EncodingType.Base64,
      });
      const bytes = base64ToBytes(b64);
      const name = decodeURIComponent(uri.split('%2F').pop() ?? uri.split('/').pop() ?? 'sticker.webp');
      const res = validateSticker(bytes);
      if (res.ok) {
        stickers.push({ name, bytes, info: res.info });
      } else {
        rejected.push({ name, bytes: new Uint8Array(), info: null, rejected: res.reason });
      }
    } catch {
      /* unreadable entry — skip rather than abort the whole scan */
    }
  }

  // Deliberately not truncated here — splitIntoPacks chunks the full set,
  // so a folder with 90 stickers becomes three packs instead of losing 60.
  return {
    packName: '',
    author: '',
    animated: stickers.some((s) => s.info?.animated),
    stickers,
    rejected,
  };
}

/**
 * A folder can hold far more than one pack's worth. Split into chunks the
 * server will accept so a 90-sticker folder becomes three packs.
 */
export function splitIntoPacks(preview: ImportPreview, baseName: string): ImportPreview[] {
  const all = preview.stickers;
  if (all.length <= MAX_STICKERS) {
    return [{ ...preview, packName: preview.packName || baseName }];
  }
  const out: ImportPreview[] = [];
  for (let i = 0; i < all.length; i += MAX_STICKERS) {
    const slice = all.slice(i, i + MAX_STICKERS);
    out.push({
      ...preview,
      packName: `${baseName} ${Math.floor(i / MAX_STICKERS) + 1}`,
      stickers: slice,
      animated: slice.some((s) => s.info?.animated),
      rejected: i === 0 ? preview.rejected : [],
    });
  }
  return out;
}
