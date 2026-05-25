# Socialize — Server

> Go API. One binary, MVC modules, Postgres + Redis. WhatsApp bridge over mautrix.

This is the **basic scaffold** on the `backend/dev` integration branch — enough to compile, boot, talk to Postgres + Redis, and answer `GET /api/healthz`. The auth module wires the canonical happy-path; the WhatsApp bridge handlers return `501 Not Implemented` until the per-feature branches land.

Full design notes:
- [docs/tech/architecture.md](../docs/tech/architecture.md)
- [docs/tech/backend-go.md](../docs/tech/backend-go.md)
- [docs/tech/database.md](../docs/tech/database.md)
- [docs/tech/whatsapp-bridge.md](../docs/tech/whatsapp-bridge.md)
- [docs/security/encryption.md](../docs/security/encryption.md)
- [docs/tech/services-and-branches.md](../docs/tech/services-and-branches.md)

---

## Layout

```
server/
├── cmd/api/                       # entry point
├── internal/
│   ├── config/                    # env → typed config
│   ├── middleware/                # request-id, recovery
│   ├── platform/{postgres,redis}/ # connection lifecycle
│   ├── server/                    # bootstrap: wires modules
│   └── modules/                   # MVC, one folder per feature
│       ├── health/
│       ├── auth/                  # phone OTP + JWT skeleton
│       └── bridges/whatsapp/      # mautrix façade (skeleton)
├── migrations/                    # *.sql, golang-migrate
├── deploy/docker/                 # docker-compose + Dockerfile
├── .env.example
├── Makefile
└── README.md
```

Each `internal/modules/<name>/` keeps `model.go` (entities), `repository.go` (SQL), `service.go` (business logic), `controller.go` (HTTP handlers) and `routes.go` (registration). Modules never import each other's `service`/`repository` — see [docs/tech/backend-go.md](../docs/tech/backend-go.md).

---

## Quick start

```bash
cd server
cp .env.example .env

# 1) Postgres + Redis locally
make docker-up

# 2) (Optional) install golang-migrate, then run schema migrations
make migrate-up

# 3) Run the API
make dev
```

Smoke test:

```bash
curl -s localhost:8080/api/healthz   # → {"status":"ok"}
curl -s localhost:8080/api/readyz    # → 200 when both pg + redis are up

# Auth (dev — the OTP comes back in the response, no SMS):
curl -s -X POST localhost:8080/api/auth/start \
  -H 'Content-Type: application/json' \
  -d '{"phone":"+351912345678"}'
# → {"sent":true,"dev_code":"482915"}

curl -s -X POST localhost:8080/api/auth/verify \
  -H 'Content-Type: application/json' \
  -d '{"phone":"+351912345678","code":"482915","device":"dev-iPhone","platform":"ios"}'
# → { "user": { ... }, "tokens": { ... } }
```

---

## Implemented vs skeleton

| Route                                    | Auth     | State                              |
|------------------------------------------|----------|------------------------------------|
| `GET  /api/healthz`                      | public   | ✅                                  |
| `GET  /api/readyz`                       | public   | ✅ (pings pg + redis)               |
| `POST /api/auth/start`                   | public   | ✅ OTP via Redis (5 min TTL)        |
| `POST /api/auth/verify`                  | public   | ✅ creates user + issues JWT pair   |
| `POST /api/auth/refresh`                 | public   | ✅ rotates the pair in place        |
| `GET  /api/users/me`                     | required | ✅                                  |
| `PATCH /api/users/me`                    | required | ✅ partial updates (username, name, bio, avatar, privacy) |
| `GET  /api/users/availability?username=` | required | ✅ validates + checks uniqueness    |
| `GET  /api/users/by-username/:username`  | required | ✅ honours username_public          |
| `POST   /api/bridges/whatsapp/link`      | required | ⛔ 501 — `backend/bridge-whatsapp`  |
| `DELETE /api/bridges/whatsapp/link`      | required | ⛔ 501 — `backend/bridge-whatsapp`  |
| `GET    /api/bridges/whatsapp/status`    | required | ⛔ 501 — `backend/bridge-whatsapp`  |

Token shape: HS256 JWT with `sub` (user id), `dev` (device id), `typ`
(`access` or `refresh`), `iat`, `exp`. Verify with `cfg.JWT.Secret`.

The skeletons exist so the route surface is real and the mobile client can be wired against them while the implementations are written on their dedicated branches.

---

## WhatsApp bridge

The bridge is a **separate process** (mautrix-whatsapp) — *not* part of this binary. The API only owns the façade endpoints and Redis queues that connect to the sidecar.

Start it locally when you're ready to dogfood:

```bash
make docker-bridge
```

Then iterate on `backend/bridge-whatsapp`. The link/unlink flow, identification rules and threat model are spelled out in [docs/tech/whatsapp-bridge.md](../docs/tech/whatsapp-bridge.md).

---

## Conventions, briefly

- **No ORM.** `pgx` + hand-rolled SQL in `repository.go`.
- **Errors are values.** Wrap with `fmt.Errorf("...: %w", err)`. Public errors are sentinels in the module (`ErrInvalidCode`…) translated to HTTP by the controller.
- **Context first.** Every service / repo method takes `context.Context` first.
- **Time in UTC, RFC 3339 in JSON.**
- **JSON in `snake_case`, Go in `CamelCase`.**

See [docs/tech/backend-go.md](../docs/tech/backend-go.md) for the long version.
