# E2EE model audit

Status: consolidated for human review. This document is not a production approval.

## Actual direct-message path

The mobile client creates or loads account-namespaced device material, obtains
the recipient's public pre-key bundle, derives a shared root locally, and
`encryptForPeer()` produces a `soc1.` envelope. The HTTP request contains that
envelope as `content`. The Go API authorizes the chat, validates that `content`
is a `soc1.` or `soc1g.` envelope, stores it as opaque message content, and
broadcasts the same opaque value over WebSocket. Offline push carries the same
ciphertext in data, never plaintext. The recipient decrypts locally with
`decryptFromPeer()` and persists plaintext only in the encrypted local store.

Groups use `soc1g.` sender-key envelopes. Sender keys are distributed as
pairwise-sealed blobs; the server stores and routes those blobs but cannot open
them. Membership changes advance the group epoch.

Media keys and call keys are derived locally from purpose-separated shared
material. Media transport URLs and metadata are not themselves proof that the
media bytes are end-to-end encrypted; media encryption must be audited per
endpoint before making that claim.

## Removed legacy model

No current mobile caller uses `/api/sessions/init`. The endpoint, `InitSession`,
`GetSession`, `UpsertSession`, `sessionRow`, and the mobile `initSession()` helper
are removed. The old service derived a server-side AES key from peer material
and random values, then persisted it in a table called `sessions`.

That table is also the authentication refresh-token table. It must not be
dropped. Migration `0040` removes only legacy E2EE columns if they exist and
leaves auth columns and rows intact. Its down migration deliberately does not
recreate key storage.

## Properties present and absent

Present: client-side root derivation, authenticated ciphertext envelopes,
account namespacing, one-time pre-key consumption, replay/counter checks
implemented by the mobile session code, group epochs, and no server-side
identity/private-pre-key requirement.

Not present: the Signal Protocol, libsignal, or a true Double Ratchet. The
current implementation is a custom X25519/TweetNaCl construction with a simple
counter-based message-key derivation. Therefore forward secrecy, post-compromise
security, skipped-message-key handling, robust out-of-order delivery,
cryptographic identity verification, and multi-device consistency are not
established as Signal-level properties. Concurrent initiation and rekey
behavior require explicit device-level interoperability tests before approval.

## Remaining audit risks

The server still has an at-rest `MESSAGE_KEY` layer. It is not an E2EE key and
does not give the server the client root key, but it must never be described as
the E2EE mechanism. Existing historical plaintext rows, previews, logs, media,
link previews, and non-message notification categories require separate data
classification. The API now rejects new direct/group message content that is
not an E2EE envelope; human review must decide how historical plaintext is
quarantined or migrated.
