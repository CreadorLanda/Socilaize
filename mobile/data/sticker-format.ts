/** Published sticker-format limits. No imports here on purpose: this
 * module is pure byte parsing, which keeps it testable on its own. */
export const STICKER_DIMENSION = 512;
export const TRAY_DIMENSION = 96;
export const MAX_STATIC_BYTES = 100 * 1024;
export const MAX_ANIMATED_BYTES = 500 * 1024;
export const MAX_TRAY_BYTES = 50 * 1024;
export const MIN_STICKERS = 3;
export const MAX_STICKERS = 30;

/**
 * WebP header parsing, client side.
 *
 * The server reads dimensions from the bytes too — that check is the one
 * that counts, since a client can lie. This one exists so we can reject a
 * bad file *before* spending an upload on it, and so we can tell whether a
 * pack is animated (which changes the size limit).
 */

export type WebPInfo = {
  width: number;
  height: number;
  animated: boolean;
};

const ascii = (b: Uint8Array, from: number, to: number) =>
  String.fromCharCode(...b.subarray(from, to));

/** Returns null when the bytes are not a WebP we understand. */
export function readWebPInfo(bytes: Uint8Array): WebPInfo | null {
  if (bytes.length < 30) return null;
  if (ascii(bytes, 0, 4) !== 'RIFF' || ascii(bytes, 8, 12) !== 'WEBP') return null;

  const chunk = ascii(bytes, 12, 16);

  if (chunk === 'VP8X') {
    // Extended format: flags byte, then 24-bit little-endian canvas size
    // minus one. Bit 1 of the flags marks an animation.
    const animated = (bytes[20] & 0x02) !== 0;
    const width = (bytes[24] | (bytes[25] << 8) | (bytes[26] << 16)) + 1;
    const height = (bytes[27] | (bytes[28] << 8) | (bytes[29] << 16)) + 1;
    return { width, height, animated };
  }

  if (chunk === 'VP8 ') {
    // Lossy keyframe: 3-byte start code, then 14-bit dimensions.
    if (bytes[23] !== 0x9d || bytes[24] !== 0x01 || bytes[25] !== 0x2a) return null;
    const width = (bytes[26] | (bytes[27] << 8)) & 0x3fff;
    const height = (bytes[28] | (bytes[29] << 8)) & 0x3fff;
    return { width, height, animated: false };
  }

  if (chunk === 'VP8L') {
    // Lossless: signature byte, then 14 bits width-1 and 14 bits height-1.
    if (bytes[20] !== 0x2f) return null;
    const bits = bytes[21] | (bytes[22] << 8) | (bytes[23] << 16) | (bytes[24] << 24);
    const width = (bits & 0x3fff) + 1;
    const height = ((bits >>> 14) & 0x3fff) + 1;
    return { width, height, animated: false };
  }

  return null;
}

/** PNG is accepted for tray icons only. */
export function readPNGSize(bytes: Uint8Array): { width: number; height: number } | null {
  if (bytes.length < 24) return null;
  const sig = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  for (let i = 0; i < sig.length; i++) if (bytes[i] !== sig[i]) return null;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  return { width: view.getUint32(16), height: view.getUint32(20) };
}

export type ValidationResult = { ok: true; info: WebPInfo } | { ok: false; reason: string };

export function validateSticker(bytes: Uint8Array): ValidationResult {
  const info = readWebPInfo(bytes);
  if (!info) return { ok: false, reason: 'not_webp' };
  if (info.width !== STICKER_DIMENSION || info.height !== STICKER_DIMENSION) {
    return { ok: false, reason: 'wrong_size' };
  }
  const limit = info.animated ? MAX_ANIMATED_BYTES : MAX_STATIC_BYTES;
  if (bytes.length > limit) return { ok: false, reason: 'too_large' };
  return { ok: true, info };
}

export function validateTray(bytes: Uint8Array): { ok: boolean; reason?: string } {
  const size = readWebPInfo(bytes) ?? readPNGSize(bytes);
  if (!size) return { ok: false, reason: 'not_image' };
  if (size.width !== TRAY_DIMENSION || size.height !== TRAY_DIMENSION) {
    return { ok: false, reason: 'wrong_tray_size' };
  }
  if (bytes.length > MAX_TRAY_BYTES) return { ok: false, reason: 'tray_too_large' };
  return { ok: true };
}
