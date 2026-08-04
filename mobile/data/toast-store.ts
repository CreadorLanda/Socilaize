import { useSyncExternalStore } from 'react';

/**
 * Lightweight global toast (WhatsApp-style status strip).
 * Used for background story publish and other non-blocking feedback.
 */

export type ToastTone = 'info' | 'success' | 'error';

export type ToastItem = {
  id: string;
  message: string;
  tone: ToastTone;
  /** Auto-dismiss ms; 0 = sticky until replaced. */
  durationMs: number;
};

let current: ToastItem | null = null;
let hideTimer: ReturnType<typeof setTimeout> | null = null;
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((l) => l());
}

function subscribe(l: () => void) {
  listeners.add(l);
  return () => listeners.delete(l);
}

export function useToast(): ToastItem | null {
  return useSyncExternalStore(subscribe, () => current);
}

export function showToast(
  message: string,
  tone: ToastTone = 'info',
  durationMs = 2800,
): string {
  if (hideTimer) {
    clearTimeout(hideTimer);
    hideTimer = null;
  }
  const id = `t_${Date.now().toString(36)}`;
  current = { id, message, tone, durationMs };
  emit();
  if (durationMs > 0) {
    hideTimer = setTimeout(() => {
      if (current?.id === id) {
        current = null;
        emit();
      }
    }, durationMs);
  }
  return id;
}

export function hideToast(id?: string) {
  if (id && current?.id !== id) return;
  if (hideTimer) {
    clearTimeout(hideTimer);
    hideTimer = null;
  }
  current = null;
  emit();
}
