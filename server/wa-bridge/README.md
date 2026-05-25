# wa-bridge

Node.js sidecar that wraps [`@whiskeysockets/baileys`](https://github.com/WhiskeySockets/Baileys) so the Go API can pair / chat with WhatsApp without embedding the protocol client itself.

## Why this exists

The Go API used `go.mau.fi/whatsmeow` directly. Both libraries implement the same WhatsApp Web protocol, but Baileys is updated more frequently and the typical usage pattern (`useMultiFileAuthState` per user) keeps WhatsApp from treating retries as fresh strangers. Switching to a sidecar:

- isolates the WhatsApp protocol churn from the Go side — the Go code now talks to a stable HTTP contract;
- gives us a clean place to put richer message bridging logic later (Baileys' `messages.upsert` is more ergonomic in JS);
- means we can swap to a different lib (e.g. whatsapp-web.js) without touching Go again.

## Architecture

```
[Go API :8080] ──HTTP──▶ [wa-bridge :3001]   POST /pair/start, /pair/status, /pair/:id
       ▲                       │
       └── webhook (Bearer) ───┘             POST $SOCIALIZE_WEBHOOK_URL on events
```

## HTTP API

All endpoints require `Authorization: Bearer $SOCIALIZE_INTERNAL_TOKEN`.

| Method | Path                   | Body                            | Response                                                 |
|--------|------------------------|---------------------------------|----------------------------------------------------------|
| GET    | `/healthz`             | —                               | `{ status: "ok" }` (no auth needed)                       |
| POST   | `/pair/start`          | `{ user_id, phone }`            | `{ pairing_code, expires_at }`                            |
| GET    | `/pair/status?user_id` | —                               | `{ status, phone?, jid?, last_error? }`                   |
| DELETE | `/pair/:user_id`       | —                               | `204`                                                     |

## Webhook payloads (sidecar → Go)

```ts
type BridgeEvent =
  | { type: 'pair_success'; user_id: string; jid: string }
  | { type: 'pair_error';   user_id: string; reason: string }
  | { type: 'logged_out';   user_id: string }
  | { type: 'connection';   user_id: string; state: 'open' | 'connecting' | 'close' };
```

## Local dev

```bash
cd server/wa-bridge
bun install

export SOCIALIZE_INTERNAL_TOKEN=$(openssl rand -hex 32)
export SOCIALIZE_WEBHOOK_URL=http://localhost:8080/api/internal/wa/events
bun run dev
```

Then make sure the Go API has the same token + a URL pointing at the sidecar (`WA_BRIDGE_URL=http://localhost:3001`).

## Auth state

Per-user creds live under `./auth_info/<user_id>/`. The directory is git-ignored and bind-mounted from the host (or a docker volume in compose). Wiping it forces a fresh pair next attempt; that's exactly what the `DELETE /pair/:user_id` endpoint does.
