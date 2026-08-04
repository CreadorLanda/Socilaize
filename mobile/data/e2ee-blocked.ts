import { E2EEUnavailable } from '@/data/crypto';
import { appAlert } from '@/data/dialog-store';
import { t } from '@/i18n';

/**
 * Tell the user why a message was not sent.
 *
 * Refusing to send is only defensible if the refusal is legible. "Message
 * failed" would be worse than the silent plaintext fallback it replaces:
 * the message would still not arrive, and now the person would have no idea
 * why or whether trying again could help.
 *
 * Each reason maps to a different thing the reader can do, which is the only
 * reason the reasons are distinguished at all.
 */
export function reportE2EEBlocked(err: unknown): void {
  const reason = err instanceof E2EEUnavailable ? err.reason : 'failed';

  // Logged as well as shown: the failure used to be swallowed entirely, and
  // the guess left in its place ("peer has no bundle yet") went years without
  // anyone being able to confirm or refute it.
  console.warn('[e2ee] send blocked:', reason, err);

  appAlert(t('chat.e2ee_blocked_title'), t(`chat.e2ee_blocked_${reason}`));
}

/**
 * The same explanation, as a string.
 *
 * The media send paths already funnel every failure into one catch that
 * renders a message; without this they would answer a refusal to encrypt
 * with "action failed", which tells the reader nothing about the one thing
 * that went wrong and is fixable.
 */
export function describeE2EEBlocked(err: unknown): string | null {
  if (!(err instanceof E2EEUnavailable)) return null;
  console.warn('[e2ee] send blocked:', err.reason, err.cause);
  return t(`chat.e2ee_blocked_${err.reason}`);
}
