import { useSyncExternalStore } from 'react';

/**
 * App dialogs, callable from anywhere.
 *
 * Deliberately imperative and Alert-shaped. The alternative — a piece of
 * state and a mounted component in every screen that needs to ask something
 * — meant sixty call sites would each grow their own plumbing, and the
 * screens that already had it did it four different ways.
 *
 * The signature matches Alert.alert on purpose, so replacing one with the
 * other is a rename rather than a rewrite, and nobody has to remember two
 * shapes.
 */

export type DialogButton = {
  text: string;
  onPress?: () => void;
  style?: 'default' | 'cancel' | 'destructive';
};

export type DialogRequest = {
  id: number;
  title: string;
  message?: string;
  buttons: DialogButton[];
  /** Present when the dialog asks for text rather than only a choice. */
  input?: {
    placeholder?: string;
    initialValue?: string;
    secure?: boolean;
    multiline?: boolean;
    keyboard?: 'default' | 'number-pad';
    /** Called with the typed value; return false to keep the dialog open. */
    onSubmit: (value: string) => boolean | Promise<boolean>;
    submitLabel?: string;
  };
};

let current: DialogRequest | null = null;
let queue: DialogRequest[] = [];
let nextId = 1;
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((l) => l());
}

function subscribe(l: () => void) {
  listeners.add(l);
  return () => listeners.delete(l);
}

function push(req: Omit<DialogRequest, 'id'>) {
  const withId = { ...req, id: nextId++ };
  // One at a time. Two dialogs stacked on top of each other is how people
  // dismiss the second without ever reading the first.
  if (current) queue.push(withId);
  else current = withId;
  emit();
}

/** Close the open dialog and show whatever was waiting behind it. */
export function dismissDialog(): void {
  current = queue.shift() ?? null;
  emit();
}

/**
 * Alert-compatible. `appAlert(title)`, `appAlert(title, message)`, or with
 * buttons exactly as Alert.alert takes them.
 */
export function appAlert(title: string, message?: string, buttons?: DialogButton[]): void {
  push({
    title,
    message,
    buttons: buttons?.length ? buttons : [{ text: 'OK', style: 'cancel' }],
  });
}

/**
 * Ask for a line of text.
 *
 * Replaces Alert.prompt, which only ever worked on iOS — every Android user
 * hit a dialog that could not take the input it was asking for.
 */
export function appPrompt(
  title: string,
  opts: {
    message?: string;
    placeholder?: string;
    initialValue?: string;
    secure?: boolean;
    multiline?: boolean;
    keyboard?: 'default' | 'number-pad';
    submitLabel?: string;
    cancelLabel?: string;
    extraButton?: DialogButton;
    onSubmit: (value: string) => boolean | Promise<boolean>;
  },
): void {
  const buttons: DialogButton[] = [{ text: opts.cancelLabel ?? 'Cancel', style: 'cancel' }];
  if (opts.extraButton) buttons.push(opts.extraButton);
  push({
    title,
    message: opts.message,
    buttons,
    input: {
      placeholder: opts.placeholder,
      initialValue: opts.initialValue,
      secure: opts.secure,
      multiline: opts.multiline,
      keyboard: opts.keyboard,
      onSubmit: opts.onSubmit,
      submitLabel: opts.submitLabel,
    },
  });
}

export function useDialog(): DialogRequest | null {
  return useSyncExternalStore(
    subscribe,
    () => current,
    () => current,
  );
}

/** Drop everything pending — used on sign-out so nothing survives the account. */
export function resetDialogs(): void {
  current = null;
  queue = [];
  emit();
}
