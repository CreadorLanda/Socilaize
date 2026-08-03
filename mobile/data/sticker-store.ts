import * as SecureStore from 'expo-secure-store';
import { useSyncExternalStore } from 'react';

import {
  createStickerPack,
  deleteStickerPack,
  getStickerPack,
  listStickerPacks,
  type CreatePackBody,
  type StickerDTO,
  type StickerPackDTO,
} from './api/stickers';

/**
 * Imported sticker packs plus a local "recently used" tray, which is the
 * first thing the picker shows — same as every messenger.
 *
 * Recents are device-local on purpose: which stickers you reach for is a
 * usage habit, not account data worth syncing.
 */

const RECENTS_KEY = 'stickers.recents.v1';
const MAX_RECENTS = 24;

let packs: StickerPackDTO[] = [];
let recents: StickerDTO[] = [];
let loaded = false;
let inFlight: Promise<void> | null = null;

const listeners = new Set<() => void>();

function emit() {
  packs = [...packs];
  recents = [...recents];
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export async function refreshStickerPacks(): Promise<void> {
  if (inFlight) return inFlight;
  inFlight = (async () => {
    try {
      const list = await listStickerPacks();
      // The list endpoint omits the stickers themselves; fetch each pack so
      // the picker can render a grid without a request per tab switch.
      const full = await Promise.all(
        list.map((p) => getStickerPack(p.id).catch(() => ({ ...p, stickers: [] }))),
      );
      packs = full;
      loaded = true;
      emit();
    } catch {
      loaded = true;
    } finally {
      inFlight = null;
    }
  })();
  return inFlight;
}

export async function bootstrapStickers(): Promise<void> {
  try {
    const raw = await SecureStore.getItemAsync(RECENTS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        recents = parsed as StickerDTO[];
        emit();
      }
    }
  } catch {
    /* start with an empty tray rather than blocking the picker */
  }
  await refreshStickerPacks();
}

export function noteStickerUsed(sticker: StickerDTO): void {
  recents = [sticker, ...recents.filter((s) => s.id !== sticker.id)].slice(0, MAX_RECENTS);
  emit();
  void SecureStore.setItemAsync(RECENTS_KEY, JSON.stringify(recents)).catch(() => {});
}

export async function importPack(body: CreatePackBody): Promise<StickerPackDTO> {
  const pack = await createStickerPack(body);
  await refreshStickerPacks();
  return pack;
}

export async function removePack(id: string): Promise<void> {
  const before = packs;
  packs = packs.filter((p) => p.id !== id);
  // Drop its stickers from the recents tray too, or they render as broken.
  recents = recents.filter((s) => !before.find((p) => p.id === id)?.stickers?.some((x) => x.id === s.id));
  emit();
  try {
    await deleteStickerPack(id);
    void SecureStore.setItemAsync(RECENTS_KEY, JSON.stringify(recents)).catch(() => {});
  } catch {
    packs = before;
    emit();
    throw new Error('pack_delete_failed');
  }
}

export function useStickerPacks(): { packs: StickerPackDTO[]; loaded: boolean } {
  const list = useSyncExternalStore(
    subscribe,
    () => packs,
    () => packs,
  );
  return { packs: list, loaded };
}

export function useRecentStickers(): StickerDTO[] {
  return useSyncExternalStore(
    subscribe,
    () => recents,
    () => recents,
  );
}

/** Drop packs and recents on sign-out. */
export function resetStickerStore(): void {
  packs = [];
  recents = [];
  loaded = false;
  inFlight = null;
  emit();
}
