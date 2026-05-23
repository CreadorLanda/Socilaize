# 🔗 WhatsApp Bridge (mautrix)

> See WhatsApp chats, statuses, contacts, groups and channels inside the Socialize inbox — clearly labelled, never silently mixed with native chats.

---

## Why a bridge

Users with WhatsApp shouldn't have to switch apps to read or reply. By bridging WhatsApp via **mautrix-whatsapp** (built on `whatsmeow`), Socialize can:

- Show WhatsApp 1:1 and group conversations.
- Reflect delivered / read receipts, typing, presence.
- Send replies, reactions, media (subject to WhatsApp's own limits).
- Surface WhatsApp Channels.

The trade-off — covered in detail in *Threat model* below — is explicit: bridging breaks WhatsApp's E2E on the bridge hop. We document it, surface it to users before they link, and isolate bridge data from native data.

---

## Architecture

```
   Socialize mobile / web
        │
        │  HTTPS / WSS
        ▼
   ┌─────────────────────────┐
   │  Socialize API          │
   │  bridges/whatsapp ctrl  │── gRPC / Redis ──┐
   └─────────────────────────┘                  │
                                                ▼
                                  ┌─────────────────────────────┐
                                  │ mautrix-whatsapp worker     │
                                  │ (one process per linked     │
                                  │  user, uses whatsmeow)      │
                                  └──────────────┬──────────────┘
                                                 │  WebSocket
                                                 ▼
                                          WhatsApp servers
```

Workers are stateful and pin to a single node per user. The session blob (whatsmeow's persistent state) is **encrypted at rest** with a per-user key and stored in `bridge_links.session_blob_enc`.

---

## Linking a WhatsApp account

1. User opens *Settings → Bridges → Link WhatsApp*.
2. App calls `POST /bridges/whatsapp/link` → the API spins up (or reuses) a worker for that user.
3. Worker initiates a whatsmeow login → returns a QR string.
4. App renders the QR; user scans with WhatsApp on their phone (Linked Devices flow).
5. Worker captures the session, encrypts it, persists to `bridge_links`.
6. Initial sync pulls chats, contacts and recent history. Each becomes a row in the user's local SQLite with `source = 'whatsapp'`.

Unlinking calls `DELETE /bridges/whatsapp/link` → worker logs out of WhatsApp, the session blob is deleted, and bridged chats can optionally be wiped from the local SQLite (with user confirmation).

---

## Identifying WhatsApp chats

Native and WhatsApp chats live in the same inbox but are **never visually confused**:

| Aspect           | Native (`s:…`)                    | WhatsApp (`wa:…`)                            |
|------------------|-----------------------------------|----------------------------------------------|
| Chat row badge   | None                              | Small WhatsApp tag next to the name          |
| Chat header      | Standard subtitle                 | "via WhatsApp · End-to-end on WhatsApp side" |
| Avatar accent    | App primary                       | WhatsApp green ring                          |
| Send capability  | Always                            | Only when bridge is healthy                  |
| E2E indicator    | "End-to-end encrypted (Signal)"   | "End-to-end on WhatsApp · bridged"           |
| Reactions        | App's reaction set                | WhatsApp's allowed set only                  |

Filter chips on the chats list expose a `WhatsApp` filter so the user can isolate bridged chats.

---

## Data shape

### Server (`bridge_links`, in Postgres)

```sql
CREATE TABLE bridge_links (
  id              UUID PRIMARY KEY,
  user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  provider        TEXT NOT NULL,                 -- 'whatsapp'
  external_id     TEXT NOT NULL,                 -- WhatsApp JID
  session_blob_enc BYTEA NOT NULL,               -- whatsmeow state, encrypted
  status          TEXT NOT NULL,                 -- linked | logged_out | error
  linked_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_synced_at  TIMESTAMPTZ
);
```

No WhatsApp message content is stored on our server. Messages arrive via the worker and are forwarded to the user's device(s) over WS, then persisted locally with `source = 'whatsapp'`.

### Client (in SQLite)

```sql
chats        (id, source, name, …, bridge_jid)        -- bridge_jid set for source='whatsapp'
messages     (id, chat_id, …, bridge_origin TEXT)     -- 'whatsapp' for bridged messages
bridge_state (provider TEXT PRIMARY KEY, status, last_synced_at, last_error)
```

---

## Message flow

### Inbound (WhatsApp → user)

1. WhatsApp delivers an event to whatsmeow inside the worker.
2. Worker normalises the event (text, media URL, reaction, receipt, typing, …) and writes it to Redis stream `q:bridge.inbound:{user_id}`.
3. The Realtime hub consumes the stream, fans the event out over the user's WS connections.
4. The client persists the message in its local SQLite with `source = 'whatsapp'`.

### Outbound (user → WhatsApp)

1. App calls `POST /messages` with `chat_id` prefixed `wa:`.
2. Controller sees the prefix, routes to the bridge service.
3. Bridge service enqueues `q:bridge.outbound:{user_id}` with the payload.
4. Worker consumes, calls `whatsmeow` to send, captures the message ID + receipts.
5. Receipts propagate back as inbound events.

### Media

Bridged media is downloaded by the worker (via whatsmeow), re-encrypted with the same envelope scheme as native media, and uploaded to object storage. The client fetches by URL; the worker can stream directly for small payloads.

---

## Operational

- **One worker per linked user.** Use Redis lease keys (`bridge:{user_id}:lock`) to pin workers; on failure the lease expires and another node takes over.
- **Health checks** — worker publishes `bridge:{user_id}:status` heartbeats; if stale, the API surfaces a "connection lost" state to the client.
- **Backpressure** — Redis streams are bounded; if a worker can't keep up, the API throttles outbound sends and informs the user.
- **Reconnect** — workers auto-resume from the encrypted session blob after restarts.

---

## Threat model & user disclosure

Bridging an E2E protocol means **the bridge sees plaintext** on the bridging hop. We are explicit:

1. The link flow ends with a screen titled "How WhatsApp bridging works", explaining:
   - WhatsApp messages are end-to-end encrypted *between WhatsApp clients*.
   - The bridge worker is, by definition, a WhatsApp client — it can read message content.
   - Socialize encrypts and isolates the worker's session and data, but operators with full server access could in principle read bridged messages.
   - Native Socialize chats keep their Signal E2E intact and are **not** affected.
2. The same screen is reachable from the bridge settings at any time.
3. Bridge data is stored with the same envelope encryption as media, but cannot benefit from end-user E2E.

This is the same trade-off every WhatsApp bridge has. Documenting it openly is what differs.

---

## Roadmap

- v0.1 — link, receive, send text & media in 1:1.
- v0.2 — groups, reactions, receipts, typing.
- v0.3 — WhatsApp Channels (read).
- v0.4 — disappearing messages parity, contacts sync, status (story) read.
- v0.5 — multi-device parity, edit / delete propagation.

Tracking issue: **#30 [Backend] WhatsApp Integration via mautrix**.
