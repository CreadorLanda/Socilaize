import * as SecureStore from 'expo-secure-store';

import { ACCESS_KEY, ApiError, BASE_URL } from './client';

export type MediaKind = 'image' | 'video' | 'audio' | 'document' | 'other';

export interface MediaObject {
  id: string;
  owner_id: string;
  kind: MediaKind;
  mime_type: string;
  size_bytes: number;
  width?: number;
  height?: number;
  duration_ms?: number;
  original_name?: string;
  /** Relative API path, e.g. /api/media/{id}/file */
  url: string;
  created_at: string;
}

/** Absolute URL for <Image source={{ uri }} /> etc. */
export function mediaFileURL(pathOrId: string): string {
  if (pathOrId.startsWith('http://') || pathOrId.startsWith('https://') || pathOrId.startsWith('file:')) {
    return pathOrId;
  }
  if (pathOrId.startsWith('/')) {
    return `${BASE_URL}${pathOrId}`;
  }
  // bare uuid
  return `${BASE_URL}/api/media/${pathOrId}/file`;
}

export type UploadOpts = {
  uri: string;
  name?: string;
  mimeType?: string;
  width?: number;
  height?: number;
  durationMs?: number;
};

/**
 * Multipart upload. RN FormData needs { uri, name, type } as the file value.
 */
export async function uploadMedia(opts: UploadOpts): Promise<MediaObject> {
  const name = opts.name ?? guessName(opts.uri, opts.mimeType);
  const type = opts.mimeType ?? guessMime(name);

  const form = new FormData();
  form.append('file', {
    uri: opts.uri,
    name,
    type,
  } as unknown as Blob);
  if (opts.width != null) form.append('width', String(opts.width));
  if (opts.height != null) form.append('height', String(opts.height));
  if (opts.durationMs != null) form.append('duration_ms', String(opts.durationMs));

  const access = await SecureStore.getItemAsync(ACCESS_KEY);
  const headers: Record<string, string> = {};
  if (access) headers.Authorization = `Bearer ${access}`;
  // Do NOT set Content-Type — fetch will add multipart boundary.

  const res = await fetch(`${BASE_URL}/api/media/upload`, {
    method: 'POST',
    headers,
    body: form,
  });

  if (!res.ok) {
    let body: { error?: string; detail?: string } = {};
    try {
      body = (await res.json()) as typeof body;
    } catch {
      /* ignore */
    }
    throw new ApiError(res.status, body.error ?? `http_${res.status}`, body.detail ?? body.error);
  }
  return (await res.json()) as MediaObject;
}

export async function deleteMedia(id: string): Promise<void> {
  const access = await SecureStore.getItemAsync(ACCESS_KEY);
  const headers: Record<string, string> = {};
  if (access) headers.Authorization = `Bearer ${access}`;
  const res = await fetch(`${BASE_URL}/api/media/${id}`, {
    method: 'DELETE',
    headers,
  });
  if (!res.ok && res.status !== 204) {
    throw new ApiError(res.status, `http_${res.status}`);
  }
}

function guessName(uri: string, mime?: string): string {
  const base = uri.split('?')[0].split('/').pop() || 'upload';
  if (base.includes('.')) return base;
  if (mime?.startsWith('image/')) return `photo.${mime.split('/')[1] || 'jpg'}`;
  if (mime?.startsWith('video/')) return `video.${mime.split('/')[1] || 'mp4'}`;
  if (mime?.startsWith('audio/')) return `audio.${mime.split('/')[1] || 'm4a'}`;
  return 'upload.bin';
}

function guessMime(name: string): string {
  const lower = name.toLowerCase();
  if (lower.endsWith('.png')) return 'image/png';
  if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) return 'image/jpeg';
  if (lower.endsWith('.webp')) return 'image/webp';
  if (lower.endsWith('.gif')) return 'image/gif';
  if (lower.endsWith('.mp4')) return 'video/mp4';
  if (lower.endsWith('.mov')) return 'video/quicktime';
  if (lower.endsWith('.m4a')) return 'audio/mp4';
  if (lower.endsWith('.mp3')) return 'audio/mpeg';
  if (lower.endsWith('.pdf')) return 'application/pdf';
  return 'application/octet-stream';
}

/** Encode media message content (JSON) for the messages API. */
export function encodeMediaContent(url: string, caption?: string): string {
  return JSON.stringify({ url, caption: caption ?? '' });
}

/** Decode media message content; falls back to plain URL / text. */
export function decodeMediaContent(content: string): { url: string; caption: string } | null {
  const trimmed = content.trim();
  if (trimmed.startsWith('{')) {
    try {
      const o = JSON.parse(trimmed) as { url?: string; caption?: string };
      if (o.url) return { url: o.url, caption: o.caption ?? '' };
    } catch {
      /* fall through */
    }
  }
  if (trimmed.includes('/api/media/') || trimmed.startsWith('http')) {
    return { url: trimmed, caption: '' };
  }
  return null;
}
