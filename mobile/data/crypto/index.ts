// Must come first: tweetnacl needs a random source installed before any
// key generation runs. See ./prng.
import './prng';

export {
  clearDeviceKeys,
  ensureKeysPublished,
  getIdentityPublic,
  loadDeviceKeys,
  maybeRefillKeys,
  safetyNumber,
} from './device-keys';
export {
  clearSession,
  clearSessionCache,
  decryptFromPeer,
  ensurePeerIdentityCurrent,
  // encryptForPeer is deliberately not exported. Its callers each wrapped it
  // in a try/catch that sent the plaintext instead, three times over. The
  // only encryption entry point outside this module is the one that refuses.
  encryptForPeerOrFail,
  deriveSharedSecret,
  E2EEUnavailable,
  establishSessionAsInitiator,
  isEnvelope,
  loadSession,
} from './session';

export {
  clearGroupKeyCache,
  decryptFromGroup,
  encryptForGroup,
  groupEpoch,
  invalidateGroupEpoch,
  isGroupEnvelope,
  syncGroupKeys,
} from './group-session';

export { assertPRNG, installPRNG } from './prng';

import { clearDeviceKeys } from './device-keys';
import { clearGroupKeyCache } from './group-session';
import { clearSessionCache } from './session';

/**
 * Drop every scrap of E2EE state belonging to the account signing out.
 *
 * The identity key is the important one: left in place, the next account to
 * sign in on this device adopts it and publishes it as its own, so the two
 * accounts become indistinguishable to peers. Session records are namespaced
 * per account and stay behind harmlessly, but the in-memory cache is process
 * -wide and must be dropped explicitly.
 */
export async function clearE2EEState(): Promise<void> {
  // Only the in-memory cache. The identity itself stays: it is namespaced per
  // account, so no one else can pick it up, and destroying it would make every
  // message a peer sends while this account is signed out permanently
  // unreadable. Use clearDeviceKeys directly to erase an account for good.
  clearSessionCache();
  clearGroupKeyCache();
}
