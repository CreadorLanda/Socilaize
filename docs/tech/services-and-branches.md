# 🧭 Services & Branches

> One Go binary, organised as MVC modules; one branch per backend feature.

---

## Module ↔ issue ↔ branch

| Branch                       | Issue | Module(s)                                              | Scope                                                                                              |
|------------------------------|-------|--------------------------------------------------------|----------------------------------------------------------------------------------------------------|
| `backend/base`               | —     | scaffold, `platform/*`, `realtime`, shared middleware  | Repo layout, Postgres + Redis bootstrap, config, request-id / logging, base CI                     |
| `backend/auth`               | #23   | `auth`, `users`                                        | Phone login, JWT + refresh, devices, Signal pre-key bundles, profile basics                        |
| `backend/messages`           | #24   | `messages`, `realtime`                                 | E2E envelopes, WS hub, delivery + read receipts, typing, message search index hooks                |
| `backend/groups`             | #27   | `groups`                                               | Groups, invitations, history mode, Sender Keys group encryption helpers                            |
| `backend/stories`            | #25   | `stories`                                              | Story upload, visibility, expiry, viewers, reactions                                               |
| `backend/media`              | #28   | `media`                                                | Upload, transcoding queue, thumbnails, envelope-encrypted storage, sticker packs                   |
| `backend/badges`             | #26   | `badges`                                               | Badge catalog, awarding pipeline, verification flow                                                |
| `backend/notifications`      | #29   | `notifications`, infra                                 | FCM/APNs, push token lifecycle, queues, Docker / K8s manifests                                     |
| `backend/bridge-whatsapp`    | #30   | `bridges/whatsapp`                                     | mautrix sidecar, link/unlink, in/out queues, status surface, see [whatsapp-bridge.md](./whatsapp-bridge.md) |
| `backend/ai-dandara` *(later)* | #18 | `ai`                                                   | `/ai/chat`, `/ai/summarize`, `/ai/reply-suggestions`, voice commands                               |

`backend/ai-dandara` isn't on the priority backend issue list but it has an open client-side implementation in the mobile app; the branch lands when the foundational modules are stable.

---

## Workflow

```
main
 ├── backend/base                 (scaffold + docs)
 │    ├── backend/auth            (PR → backend/base)
 │    ├── backend/messages        (PR → backend/base)
 │    ├── …
 │    └── backend/bridge-whatsapp (PR → backend/base)
 │
 └── main ◄── backend/base        (PR when MVP is stable)
```

Note: the base branch is named `backend/base` (and not just `backend`) because git cannot have a branch called `backend` while there are also branches named `backend/<feature>` — refs would collide.

Rules:

1. Branch off `backend/base` (not `main`).
2. One PR per feature branch into `backend/base`.
3. Each PR ships **migrations + code + tests + docs** (no half features).
4. `backend/base` only merges into `main` when:
   - Auth, Messages, Media and Notifications are green and dogfooded.
   - The mobile app can run end-to-end against the API without mocks for the core chat flow.
5. CI on `backend/base` runs the full integration suite (Postgres + Redis via `testcontainers`).

---

## Dependency order (recommended landing sequence)

```
backend
  ↓
backend/auth ───────────────┐
  ↓                          │
backend/messages ──► backend/notifications
  ↓                          │
backend/groups               │
  ↓                          │
backend/media (parallel)     │
  ↓                          │
backend/stories              │
  ↓                          │
backend/badges (independent) │
                             │
backend/bridge-whatsapp ◄────┘ (needs auth + messages + notifications)
backend/ai-dandara              (needs auth + messages)
```

`backend/media` and `backend/badges` are largely independent and can be picked up in parallel once auth is in.

---

## Definition of done — per backend module

- [ ] Migrations land cleanly (up and down).
- [ ] Public HTTP/WS contract documented in `docs/tech/api.md`.
- [ ] Service has unit tests (mocks) and integration tests (real Postgres / Redis).
- [ ] Security checklist passed where the module touches keys or PII:
  - [ ] Inputs validated and rate-limited.
  - [ ] No secrets in logs.
  - [ ] At-rest encryption applied to any PII / tokens / sessions.
  - [ ] Threat model section added or updated in the relevant doc.
- [ ] OpenTelemetry traces emitted on the hot paths.
- [ ] Mobile client wiring landed on a sibling branch in `mobile/`, behind a feature flag if needed.
