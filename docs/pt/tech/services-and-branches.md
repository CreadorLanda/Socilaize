# 🧭 Serviços & Branches

> Um único binário Go, organizado como módulos MVC; uma branch por funcionalidade de backend.

---

## Módulo ↔ issue ↔ branch

| Branch                       | Issue | Módulo(s)                                              | Âmbito                                                                                              |
|------------------------------|-------|--------------------------------------------------------|-----------------------------------------------------------------------------------------------------|
| `backend/base`               | —     | scaffold, `platform/*`, `realtime`, middleware partilhado | Layout do repo, bootstrap Postgres + Redis, config, request-id / logging, CI base                |
| `backend/auth`               | #23   | `auth`, `users`                                        | Login por telefone, JWT + refresh, dispositivos, pre-key bundles Signal, perfil básico              |
| `backend/messages`           | #24   | `messages`, `realtime`                                 | Envelopes E2E, hub WS, entrega + recibos de leitura, "a escrever", hooks de pesquisa de mensagens   |
| `backend/groups`             | #27   | `groups`                                               | Grupos, convites, modos de histórico, helpers de encriptação Sender Keys                            |
| `backend/stories`            | #25   | `stories`                                              | Upload, visibilidade, expiração, viewers, reações                                                   |
| `backend/media`              | #28   | `media`                                                | Upload, fila de transcoding, thumbnails, armazenamento com envelope encryption, packs de stickers   |
| `backend/badges`             | #26   | `badges`                                               | Catálogo, pipeline de atribuição, fluxo de verificação                                              |
| `backend/notifications`      | #29   | `notifications`, infra                                 | FCM/APNs, ciclo de vida do push token, filas, manifests Docker / K8s                                |
| `backend/bridge-whatsapp`    | #30   | `bridges/whatsapp`                                     | Sidecar mautrix, link/unlink, filas in/out, superfície de estado, ver [whatsapp-bridge.md](./whatsapp-bridge.md) |
| `backend/ai-dandara` *(mais tarde)* | #18 | `ai`                                              | `/ai/chat`, `/ai/summarize`, `/ai/reply-suggestions`, comandos de voz                               |

`backend/ai-dandara` não está na lista de issues prioritárias mas há já implementação cliente na app móvel; a branch aterra quando os módulos fundacionais estiverem estáveis.

---

## Fluxo de trabalho

```
main
 ├── backend/base                 (scaffold + docs)
 │    ├── backend/auth            (PR → backend/base)
 │    ├── backend/messages        (PR → backend/base)
 │    ├── …
 │    └── backend/bridge-whatsapp (PR → backend/base)
 │
 └── main ◄── backend/base        (PR quando MVP estável)
```

Nota: a branch base chama-se `backend/base` (e não apenas `backend`) porque o git não permite uma branch chamada `backend` coexistir com branches `backend/<feature>` — os refs entram em colisão.

Regras:

1. Branch sai de `backend/base` (não de `main`).
2. Um PR por branch de funcionalidade para `backend/base`.
3. Cada PR traz **migrações + código + testes + docs** (sem features pela metade).
4. `backend/base` só integra em `main` quando:
   - Auth, Messages, Media e Notifications estão verdes e dogfooded.
   - A app móvel corre ponta-a-ponta contra a API sem mocks no fluxo de chat principal.
5. CI em `backend/base` corre a suite de integração completa (Postgres + Redis via `testcontainers`).

---

## Ordem recomendada de aterragem

```
backend
  ↓
backend/auth ───────────────┐
  ↓                          │
backend/messages ──► backend/notifications
  ↓                          │
backend/groups               │
  ↓                          │
backend/media (paralelo)     │
  ↓                          │
backend/stories              │
  ↓                          │
backend/badges (independente)│
                             │
backend/bridge-whatsapp ◄────┘ (precisa de auth + messages + notifications)
backend/ai-dandara              (precisa de auth + messages)
```

`backend/media` e `backend/badges` são amplamente independentes e podem ser puxados em paralelo depois do auth.

---

## Definição de pronto — por módulo de backend

- [ ] Migrações aterram limpas (up e down).
- [ ] Contrato HTTP/WS público documentado em `docs/tech/api.md`.
- [ ] Service tem testes unitários (mocks) e testes de integração (Postgres / Redis reais).
- [ ] Checklist de segurança passada onde o módulo toca em chaves ou PII:
  - [ ] Inputs validados e rate-limited.
  - [ ] Sem segredos em logs.
  - [ ] Encriptação em repouso aplicada a PII / tokens / sessões.
  - [ ] Secção de modelo de ameaça adicionada ou atualizada no doc relevante.
- [ ] Traces OpenTelemetry emitidos nos hot paths.
- [ ] Wiring no cliente móvel aterra numa branch irmã em `mobile/`, atrás de feature flag se necessário.
