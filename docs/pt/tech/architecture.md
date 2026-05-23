# 🏗️ Arquitetura

> Como o Socialize é desenhado: uma plataforma de mensagens focada em segurança, com armazenamento no dispositivo, um servidor fino e uma ponte para o WhatsApp.

---

## Objetivos

1. **Encriptação ponta-a-ponta por defeito.** O servidor não pode ler o conteúdo do utilizador.
2. **As mensagens vivem no dispositivo** — abordagem WhatsApp. O servidor é apenas um relay de envelopes cifrados e metadados autoritativos.
3. **Uma única caixa de entrada coerente** para conversas Socialize e WhatsApp ligado por ponte, com identificação visual clara.
4. **Monólito modular** em Go organizado como módulos MVC — fácil de dividir mais tarde, rápido de construir já.
5. **Operação simples.** Apenas PostgreSQL + Redis. Sem MongoDB.

---

## Forma geral

```
   Cliente móvel / web
   ├─ SQLite (SQLCipher, encriptado)   ← histórico completo, no dispositivo
   └─ libsignal                        ← sessões E2E
            │
            │  HTTPS / WSS (TLS 1.3, pinning de certificado)
            ▼
┌─────────────────────────────────────────────────────────────┐
│                    API Socialize (Go)                       │
│  ┌────────────┐  ┌────────────┐  ┌────────────────────────┐ │
│  │ Controllers│→ │ Services   │→ │ Repositories           │ │
│  │ (HTTP/WS)  │  │ (lógica)   │  │ (pgx → Postgres)       │ │
│  └────────────┘  └────────────┘  └────────────────────────┘ │
│         │                                                   │
│         ▼                                                   │
│   Hub realtime (WebSocket) ── Redis pub/sub fan-out         │
└──────┬──────────────────────────────────────────────────────┘
       │                  │                    │
       ▼                  ▼                    ▼
   PostgreSQL          Redis              Object Storage
   (autoritativo)      (filas, cache,     (blobs de média
                        presença, pub/sub) cifrados)

       ▲
       │ gRPC interno
       │
┌──────┴─────────────────┐
│  Ponte WhatsApp        │
│  (mautrix-whatsapp)    │── whatsmeow ──► servidores WhatsApp
│  um worker por conta   │
│  ligada                │
└────────────────────────┘
```

---

## Componentes

### Cliente móvel
- Mantém o histórico completo em **SQLite (SQLCipher)**.
- Usa **libsignal** para sessões X3DH + Double Ratchet; grupos usam Sender Keys.
- Fala com a API via HTTPS para pedido/resposta e WSS para tempo real.
- A chave da base de dados fica na **keychain do sistema** (iOS Keychain / Android Keystore); desbloqueio biométrico opcional na abertura.

### Servidor API (Go, monólito modular)
- Um processo, organizado como módulos MVC por funcionalidade (`auth`, `users`, `messages`, `groups`, `channels`, `stories`, `media`, `badges`, `notifications`, `ai`, `bridges/whatsapp`).
- HTTP via Gin/Echo, tempo real via hub WebSocket com fan-out por Redis pub/sub (escala horizontalmente).
- Autoritativo para **metadados** (utilizadores, dispositivos, grupos, canais, stories públicos, badges, push tokens, key bundles) — não para conteúdo de mensagens.

### PostgreSQL
- Utilizadores, dispositivos, key bundles (identity / signed pre-keys / one-time pre-keys), membros de grupos, conteúdo de canais, stories públicos, badges, audit logs.
- Mantém apenas **ciphertext** para envelopes pendentes de entrega (eliminados após entrega).

### Redis
- **Filas** (Redis Streams): entrega de mensagens, push notifications, ponte WhatsApp in/out, processamento de média.
- **Cache**: tokens de sessão, contadores de rate limit.
- **Presença**: `presence:{user_id}` com TTL curto.
- **A escrever**: `typing:{chat_id}` (TTL 5 s).
- **Pub/sub**: fan-out de tempo real entre instâncias.

### Object storage (compatível S3)
- Média cifrada (imagens, vídeo, voz, documentos).
- Cada ficheiro tem uma DEK (Data Encryption Key) embrulhada por uma KEK (Key Encryption Key) em KMS/Vault.
- O servidor nunca tem média em claro.

### Ponte WhatsApp (processo separado)
- **mautrix-whatsapp** como sidecar, um worker por conta ligada, conectado ao WhatsApp via **whatsmeow**.
- Mostra conversas, mensagens, estados, contactos e grupos do WhatsApp dentro do Socialize.
- Conversas com ponte são claramente marcadas (`source: 'whatsapp'`) — ver [whatsapp-bridge.md](./whatsapp-bridge.md).

---

## Identificar conversas Socialize vs WhatsApp

Cada conversa tem um campo `source`:

| Source     | Prefixo ID     | Marca na UI                              | E2E                                       |
|------------|----------------|------------------------------------------|-------------------------------------------|
| `native`   | `s:<uuid>`     | nenhuma                                  | Signal (E2E real)                         |
| `whatsapp` | `wa:<wa_jid>`  | etiqueta WhatsApp na linha + cabeçalho   | E2E WA até à ponte, depois ponte↔servidor |

Conversas com ponte começam só de leitura e tornam-se editáveis quando a ponte estiver saudável e o envio para fora ativo. O compromisso — a ponte vê texto em claro nesse hop — está documentado e é mostrado ao utilizador antes da ligação.

---

## Ciclo de vida de uma mensagem (texto, conversa nativa)

1. Cliente A compõe a mensagem, cifra para cada dispositivo do destinatário com libsignal, produz N envelopes ciphertext.
2. Cliente A faz `POST /messages` com os envelopes + metadados de endereçamento.
3. Controller valida auth → Service guarda os envelopes em Postgres → enfileira entrega em `q:messages.deliver`.
4. Workers fazem fan-out: empurram frames WS aos destinatários online via Redis pub/sub, agendam push para os offline.
5. Cliente B recebe o envelope por WS, decifra com libsignal, persiste no seu SQLite local, faz ack.
6. Servidor apaga o envelope (ou expira por TTL curto se sem ack).

O servidor nunca vê texto em claro.

---

## Porquê um monólito modular (e não microserviços já)

A versão antiga deste documento mostrava cinco serviços. Começamos com **um** binário Go pelos seguintes motivos:

- Toda a equipa / contribuidores correm um único processo localmente.
- Transações entre módulos (registar utilizador, conceder badge, etc.) mantêm-se simples.
- O fan-out em tempo real é mais simples num único processo.
- Mantemos os benefícios *organizacionais* dos serviços (limites claros, camadas MVC) sem o custo operacional de múltiplos deploys, service meshes e tracing distribuído.
- Dividir é refactor, não rewrite — cada módulo dono do seu package e tabelas. Quando um módulo precisar de escalar isolado, extrai-se.

---

## Estratégia de branches

- `backend/base` — branch base (este scaffold + docs).
- `backend/<feature>` — uma branch por issue de backend (ver [services-and-branches.md](./services-and-branches.md)).
- PRs vão para `backend/base`; `backend/base` integra em `main` quando o MVP estiver estável.

---

## Documentos relacionados

- [Database](./database.md) — schema Postgres + Redis, SQLite no dispositivo.
- [Backend (Go, MVC)](./backend-go.md) — layout do código e convenções.
- [Armazenamento local](./local-storage.md) — SQLite + SQLCipher no dispositivo.
- [Ponte WhatsApp](./whatsapp-bridge.md) — integração via mautrix.
- [Serviços & branches](./services-and-branches.md) — mapa funcionalidade → branch → issue.
- [Encriptação](../security/encryption.md) — Signal Protocol, em repouso, em trânsito.
