# 🏗️ Infrastructure

See [deployment.md](./deployment.md) for the full deployment story. This page is the short summary of *what runs where*.

## Components

| Component         | Where                                | Notes                                              |
|-------------------|--------------------------------------|----------------------------------------------------|
| Go API            | Single binary on the VPS (systemd)   | Modular monolith, MVC modules per feature          |
| PostgreSQL 16     | Supabase (managed, hybrid topology)  | Authoritative server metadata + pending envelopes  |
| Redis 7           | Docker on the VPS (or Upstash)       | Queues (Streams), cache, presence, pub/sub        |
| Object storage    | S3-compatible (Supabase Storage or Cloudflare R2) | Envelope-encrypted media |
| mautrix-whatsapp  | Docker sidecar on the VPS (opt-in)   | One worker per linked user                         |
| Caddy             | VPS                                   | Reverse proxy + automatic TLS (Let's Encrypt)     |
| SQLite + SQLCipher | On every user device                 | Full chat history, encrypted at rest               |

**No MongoDB.** PostgreSQL handles structured data; documents with flexible shape go in JSONB columns.

## CI/CD

- GitHub Actions on every PR into `backend/base` and `main`.
- Unit + integration tests via `testcontainers` (real Postgres + Redis spun up per run).
- Build artefacts: a single static Go binary for `linux/arm64` (target Oracle Ampere) and `linux/amd64` (target generic VPS).
- Deploy: a small workflow `scp`s the binary to the VPS and triggers `systemctl restart socialize-api`.

## Local development

```bash
cd server
cp .env.example .env       # fill in Supabase + Upstash URLs (or use local fallback)
make docker-up             # starts just Redis (hybrid: Postgres comes from Supabase)
make migrate-up            # applies schema migrations
make dev                   # runs the API
```

Add `--profile local-pg` to the docker compose call to get a fully offline stack with a local Postgres container.

## See also

- [Architecture](./architecture.md)
- [Database](./database.md)
- [Deployment](./deployment.md)
- [Backend (Go, MVC)](./backend-go.md)
