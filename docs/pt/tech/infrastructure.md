# 🏗️ Infraestrutura

Ver [deployment.md](./deployment.md) para a história completa. Esta página é o resumo de *o que corre onde*.

## Componentes

| Componente        | Onde                                  | Notas                                              |
|-------------------|---------------------------------------|----------------------------------------------------|
| API Go            | Binário único na VPS (systemd)        | Monólito modular, módulos MVC por funcionalidade   |
| PostgreSQL 16     | Supabase (gerido, topologia híbrida)  | Metadados autoritativos + envelopes pendentes      |
| Redis 7           | Docker na VPS (ou Upstash)            | Filas (Streams), cache, presença, pub/sub          |
| Object storage    | Compatível S3 (Supabase Storage ou Cloudflare R2) | Média com envelope encryption          |
| mautrix-whatsapp  | Sidecar Docker na VPS (opt-in)        | Um worker por utilizador ligado                    |
| Caddy             | VPS                                    | Reverse proxy + TLS automático (Let's Encrypt)    |
| SQLite + SQLCipher | Em cada dispositivo                   | Histórico completo, cifrado em repouso             |

**Sem MongoDB.** O PostgreSQL trata dos dados estruturados; documentos com forma flexível vão em colunas JSONB.

## CI/CD

- GitHub Actions em cada PR para `backend/base` e `main`.
- Testes unitários + integração via `testcontainers` (Postgres + Redis reais por run).
- Artefactos de build: um binário Go estático para `linux/arm64` (alvo Oracle Ampere) e `linux/amd64` (alvo VPS genérica).
- Deploy: um workflow pequeno faz `scp` do binário para a VPS e dispara `systemctl restart socialize-api`.

## Desenvolvimento local

```bash
cd server
cp .env.example .env       # preenche URLs Supabase + Upstash (ou usa fallback local)
make docker-up             # arranca só Redis (híbrido: Postgres vem do Supabase)
make migrate-up            # aplica migrações do schema
make dev                   # corre a API
```

Adiciona `--profile local-pg` à chamada do docker compose para um stack totalmente offline com Postgres local em container.

## Ver também

- [Arquitetura](./architecture.md)
- [Database](./database.md)
- [Deployment](./deployment.md)
- [Backend (Go, MVC)](./backend-go.md)
