# 🔐 Encryption

> Security-first messaging means **the server can't read messages, even if compromised.** Three layers — in transit, end-to-end, at rest — work together so this holds in practice, not just in slides.

---

## In transit

- TLS 1.3 only. TLS 1.2 disabled.
- Certificate pinning on mobile clients (rotation handled via a signed update channel).
- HSTS + Strict-Transport-Security with preload on web origins.

---

## End-to-end (custom X25519 / TweetNaCl)

> **This is not the Signal Protocol.** An earlier version of this document said
> it was, and said the project used libsignal. Neither was ever true —
> `libsignal` appears in no manifest, on the client or the server. What follows
> describes what the code does.

Encryption happens on the device with [TweetNaCl](https://tweetnacl.js.org/)
(`mobile/data/crypto/`). The server stores ciphertext and holds no key
material.

### Keys

| Key type          | Lifetime              | Purpose                                        |
|-------------------|-----------------------|------------------------------------------------|
| Identity key      | Long-lived per device | Pins the device identity                       |
| Signed pre-key    | Uploaded per device   | Lets a peer start a session while you are offline |
| One-time pre-keys | Batched, single-use   | Consumed at session start                      |
| Group sender key  | Per group, per epoch  | Fan-out after pairwise distribution            |

### Envelopes

Two wire formats, both `prefix.header.body` with base64url parts:

- `soc1.` — direct. Header carries `v`, `ik` (sender identity), `n` (counter),
  plus handshake fields on the first messages.
- `soc1g.` — group. Header carries `v`, `s` (sender UUID), `e` (epoch), `n`.

The server validates the **shape only** — it never opens the body, derives a
key, or checks a MAC.

### What this construction does not give you

Stated plainly, because the previous version of this page claimed all three:

- **No Double Ratchet.** There is a monotonic send counter the code calls a
  "simple ratchet". It orders messages and detects replays. It does not rekey
  per message.
- **No forward secrecy** worth the name. Compromising a device's long-term key
  exposes past messages that device can still decrypt.
- **No post-compromise security.** There is no mechanism that heals a session
  after a key leak.

### Not audited

No independent review has been done. The construction was written for this
project. If you need the properties Signal gives you, use Signal — this is an
honest messenger, not an equivalent one.

Improving this is [tracked work](https://github.com/CreadorLanda/Socilaize/issues),
not a settled state.

## At rest

### On the server

- Postgres data files: full-disk encryption on the host (LUKS / cloud-managed encryption at rest).
- Sensitive columns (push tokens, refresh tokens): envelope-encrypted at the application layer with a Key Encryption Key held in KMS / Vault. Tables don't see plaintext.
- Object storage: every media file gets a per-file Data Encryption Key, wrapped by the KEK. The DEK is stored alongside the object metadata; loss of the KEK makes the storage unreadable.
- Backups: encrypted with a separate backup KEK, rotated independently.

### On the device

- The SQLite database is wrapped by **SQLCipher** (AES-256-CBC, page-level).
- The DB key is generated once on first launch (256-bit), then wrapped by the OS keychain:
  - iOS: Keychain with `kSecAttrAccessibleWhenUnlockedThisDeviceOnly`.
  - Android: Keystore (StrongBox where available), AES-GCM wrap.
  - macOS / Windows / Linux: Keychain / DPAPI / libsecret.
- App startup unlocks the keychain item (optionally gated by biometrics) and opens the DB.
- Detailed schema and lifecycle in [local-storage.md](../tech/local-storage.md).

---

## Authentication & sessions

- Phone-number based, with one-time codes delivered over SMS.
- Codes are 6 digits, rate-limited per phone and per IP, expire in 5 minutes, single-use.
- On success: JWT access token (short-lived, e.g. 15 minutes) + opaque refresh token (rotated on every use, family-tracked to detect theft).
- Session tokens stored hashed on the server (`SHA-256`); only the bearer holds the original.
- Logout invalidates the refresh family.

---

## Bridges

There are none, and there will not be. A bridge has to decrypt to translate,
which puts a server in a position to read messages — the one thing this
document says never happens.

The rejected WhatsApp bridge and the full reasoning are in
[decisions/0001](../decisions/0001-no-whatsapp-bridge.md).

---

## Key rotation

| Material                   | Rotation                           |
|----------------------------|------------------------------------|
| Identity key (device)      | Lifetime of the device             |
| Signed pre-key             | Every 7 days                       |
| One-time pre-keys          | Continuously consumed; client tops up when low |
| Session keys               | Not rotated per message — see above |
| Refresh tokens             | On every use                       |
| Server KEK (Vault/KMS)     | Annually, or on incident           |
| Backup KEK                 | Annually                           |
| TLS certificates           | 90 days (ACME automated)           |

---

## What is *not* protected

We say this aloud so it doesn't surprise anyone:

- **Metadata.** The server sees who messages whom and when. Sealed-sender style mitigations are tracked as a follow-up.
- **A compromised device while unlocked.** Anyone holding the unlocked phone can read everything; SQLCipher cannot defend against that.

Anything beyond this list should be reported as a bug, not a feature.
