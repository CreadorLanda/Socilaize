import { api } from './client';

/**
 * Typed wrappers around the pre-key bundle endpoints. All public material
 * crosses the wire as base64-url; raw bytes never leave this module.
 *
 * The client crypto layer is wired separately — this file only owns the
 * transport layer so the chat module can fetch / publish bundles without
 * caring about HTTP shape.
 */

export type SignedPreKey = {
  key_id: number;
  public_key: string;
  signature: string;
};

export type OneTimePreKey = {
  key_id: number;
  public_key: string;
};

export type UploadKeysRequest = {
  identity_key: string;
  signed_pre_key: SignedPreKey;
  one_time_pre_keys: OneTimePreKey[];
};

export type UploadKeysResponse = {
  one_time_remaining: number;
};

export type PreKeyBundle = {
  user_id: string;
  device_id: string;
  identity_key: string;
  signed_pre_key: SignedPreKey;
  /** Absent when the recipient's OTK pool was exhausted. */
  one_time_pre_key?: OneTimePreKey;
};

export type KeysCountResponse = {
  one_time_remaining: number;
};

export const uploadKeys = (req: UploadKeysRequest) =>
  api.put<UploadKeysResponse>('/api/users/me/keys', req);

export const myKeyCount = () =>
  api.get<KeysCountResponse>('/api/users/me/keys/count');

export const bundleForUsername = (username: string) =>
  api.get<PreKeyBundle>(`/api/users/by-username/${encodeURIComponent(username)}/keys`);

export type PeerIdentity = {
  user_id: string;
  device_id: string;
  identity_key: string;
};

/**
 * The peer's current identity, without consuming a one-time pre-key.
 *
 * bundleForUsername pops an OTK as a side effect, so it cannot be used to
 * check whether a peer is still who our session thinks they are — asking on
 * every chat open would empty their reservoir.
 */
export const identityForUsername = (username: string) =>
  api.get<PeerIdentity>(`/api/users/by-username/${encodeURIComponent(username)}/identity`);
