# 🔐 Encryption

> Security-first messaging means **the server can't read messages, even if compromised.** Three layers — in transit, end-to-end, at rest — work together so this holds in practice, not just in slides.

---

## In transit

- TLS 1.3 only. TLS 1.2 disabled.
- Certificate pinning on mobile clients (rotation handled via a signed update channel).
- HSTS + Strict-Transport-Security with preload on web origins.
- Internal traffic between API and bridge workers uses mTLS.

---

## End-to-end (Signal Protocol)

We use libsignal — the same protocol behind Signal and WhatsApp — exposed through Go bindings on the server (only for pre-key bundle handling) and through the official mobile libraries on the client (where actual encryption / decryption happens).

### Keys

| Key type                | Lifetime              | Purpose                                                          |
|-------------------------|-----------------------|------------------------------------------------------------------|
| Identity key            | Long-lived per device | Pins the device identity, signs signed pre-keys                  |
| Signed pre-key          | Rotated every 7 days  | Authenticates the device, included in X3DH                       |
| One-time pre-keys       | Batched, single-use   | Uploaded in batches; consumed at session start                   |
| Session keys            | Per chat              | Derived by X3DH, ratcheted via Double Ratchet                    |
| Sender keys             | Per group             | Used for fan-out in groups after pairwise key distribution       |

### Flows

- **X3DH** does the initial key agreement when two devices first message each other.
- **Double Ratchet** rotates session keys on every exchange, giving forward secrecy and post-compromise security.
- **Sender Keys** make group messages efficient: the sender shares a Sender Key with each member over pairwise channels, then encrypts each group message once.

### What the server stores

Only **public** material and *ciphertext* envelopes pending delivery:

- Public identity keys, signed pre-keys (with signatures), one-time pre-keys.
- Encrypted message envelopes (`message_envelopes` table) — short TTL, deleted on ack.

The server never holds:

- Private keys (those live on devices).
- Plaintext messages.
- Plaintext media.

### Identity verification

- Devices expose a 60-digit safety number per chat partner.
- The UI shows it as five rows of twelve digits, with a QR fallback for in-person verification.
- A flag is raised when a partner's identity key changes; the user must acknowledge before continuing the conversation.

---

## At rest

### On the server

- Postgres data files: full-disk encryption on the host (LUKS / cloud-managed encryption at rest).
- Sensitive columns (push tokens, bridge session blobs, refresh tokens): envelope-encrypted at the application layer with a Key Encryption Key held in KMS / Vault. Tables don't see plaintext.
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

## Bridges and E2E trade-offs

Bridging WhatsApp via mautrix breaks WhatsApp's E2E *on the bridge hop*: the bridge worker is, by definition, a WhatsApp client and can read messages. We isolate this clearly:

- Bridge data lives in separate tables and goes through a separate code path.
- Session blobs are envelope-encrypted at rest.
- The link flow forces the user to acknowledge the trade-off before completing the link.
- Native Socialize chats are *not* affected — their Signal sessions remain end-to-end.

Full disclosure text and operational details in [whatsapp-bridge.md](../tech/whatsapp-bridge.md#threat-model--user-disclosure).

---

## Key rotation

| Material                   | Rotation                           |
|----------------------------|------------------------------------|
| Identity key (device)      | Lifetime of the device             |
| Signed pre-key             | Every 7 days                       |
| One-time pre-keys          | Continuously consumed; client tops up when low |
| Session keys               | Every message (Double Ratchet)     |
| Refresh tokens             | On every use                       |
| Server KEK (Vault/KMS)     | Annually, or on incident           |
| Backup KEK                 | Annually                           |
| TLS certificates           | 90 days (ACME automated)           |

---

## What is *not* protected

We say this aloud so it doesn't surprise anyone:

- **Metadata.** The server sees who messages whom and when. Sealed-sender style mitigations are tracked as a follow-up.
- **A compromised device while unlocked.** Anyone holding the unlocked phone can read everything; SQLCipher cannot defend against that.
- **Side channels on the bridge.** Anything that goes through the WhatsApp bridge is, on that hop, accessible to the bridge worker.

Anything beyond this list should be reported as a bug, not a feature.
