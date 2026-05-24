# 🔗 Ponte WhatsApp (mautrix)

> Ver conversas, estados, contactos, grupos e canais do WhatsApp dentro da caixa de entrada do Socialize — claramente marcados, nunca silenciosamente misturados com conversas nativas.

---

## Porquê uma ponte

Quem usa WhatsApp não devia ter de trocar de app para ler ou responder. Ao ligar o WhatsApp via **mautrix-whatsapp** (sobre `whatsmeow`), o Socialize pode:

- Mostrar conversas 1:1 e grupos do WhatsApp.
- Refletir estados de entregue / lido, "a escrever" e presença.
- Enviar respostas, reações, média (sujeito aos limites do WhatsApp).
- Expor Canais do WhatsApp.

O compromisso — coberto em detalhe em *Modelo de ameaça* — é explícito: fazer ponte parte o E2E do WhatsApp no salto da ponte. Documentamos, mostramos ao utilizador antes de ligar, e isolamos os dados da ponte dos nativos.

---

## Arquitetura

```
   Socialize móvel / web
        │
        │  HTTPS / WSS
        ▼
   ┌─────────────────────────┐
   │  API Socialize          │
   │  controller bridges/wa  │── gRPC / Redis ──┐
   └─────────────────────────┘                  │
                                                ▼
                                  ┌─────────────────────────────┐
                                  │ worker mautrix-whatsapp     │
                                  │ (um processo por utilizador │
                                  │  ligado, usa whatsmeow)     │
                                  └──────────────┬──────────────┘
                                                 │  WebSocket
                                                 ▼
                                        Servidores WhatsApp
```

Os workers são stateful e ficam fixados a um nó por utilizador. O blob de sessão (estado persistente do whatsmeow) é **cifrado em repouso** com uma chave por utilizador e guardado em `bridge_links.session_blob_enc`.

---

## Ligar uma conta WhatsApp

1. Utilizador abre *Definições → Pontes → Ligar WhatsApp*.
2. App chama `POST /bridges/whatsapp/link` → API arranca (ou reusa) um worker para esse utilizador.
3. Worker inicia login whatsmeow → devolve uma string QR.
4. App mostra o QR; utilizador faz scan no WhatsApp (fluxo Dispositivos Ligados).
5. Worker captura a sessão, cifra, persiste em `bridge_links`.
6. Sincronização inicial puxa conversas, contactos e histórico recente. Cada um vira uma linha no SQLite local com `source = 'whatsapp'`.

Desligar chama `DELETE /bridges/whatsapp/link` → worker faz logout do WhatsApp, o blob de sessão é apagado, e as conversas com ponte podem opcionalmente ser limpas do SQLite local (com confirmação).

---

## Identificar conversas WhatsApp

Conversas nativas e WhatsApp partilham a mesma caixa de entrada mas **nunca se confundem visualmente**:

| Aspeto             | Nativo (`s:…`)                      | WhatsApp (`wa:…`)                              |
|--------------------|-------------------------------------|------------------------------------------------|
| Badge na lista     | Nenhum                              | Pequena etiqueta WhatsApp ao lado do nome      |
| Cabeçalho do chat  | Subtítulo normal                    | "via WhatsApp · E2E no lado WhatsApp"          |
| Acento do avatar   | Cor primária da app                 | Aro verde WhatsApp                             |
| Envio              | Sempre                              | Só quando a ponte está saudável                |
| Indicador E2E      | "Encriptada (Signal)"               | "E2E no WhatsApp · com ponte"                  |
| Reações            | Set de reações da app               | Apenas o set permitido pelo WhatsApp           |

Os chips de filtro na lista de chats expõem um filtro `WhatsApp` para isolar conversas com ponte.

---

## Forma dos dados

### Servidor (`bridge_links`, em Postgres)

```sql
CREATE TABLE bridge_links (
  id              UUID PRIMARY KEY,
  user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  provider        TEXT NOT NULL,                 -- 'whatsapp'
  external_id     TEXT NOT NULL,                 -- JID WhatsApp
  session_blob_enc BYTEA NOT NULL,               -- estado whatsmeow, cifrado
  status          TEXT NOT NULL,                 -- linked | logged_out | error
  linked_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_synced_at  TIMESTAMPTZ
);
```

Nenhum conteúdo de mensagem WhatsApp fica no nosso servidor. As mensagens chegam pelo worker e são reencaminhadas para os dispositivos do utilizador por WS, e depois persistidas localmente com `source = 'whatsapp'`.

### Cliente (em SQLite)

```sql
chats        (id, source, name, …, bridge_jid)        -- bridge_jid definido quando source='whatsapp'
messages     (id, chat_id, …, bridge_origin TEXT)     -- 'whatsapp' para mensagens com ponte
bridge_state (provider TEXT PRIMARY KEY, status, last_synced_at, last_error)
```

---

## Fluxo de mensagens

### Entrada (WhatsApp → utilizador)

1. WhatsApp entrega um evento ao whatsmeow no worker.
2. Worker normaliza (texto, URL de média, reação, recibo, "a escrever", …) e escreve em `q:bridge.inbound:{user_id}`.
3. O hub realtime consome a stream e faz fan-out via WS.
4. O cliente persiste no SQLite local com `source = 'whatsapp'`.

### Saída (utilizador → WhatsApp)

1. App chama `POST /messages` com `chat_id` prefixado `wa:`.
2. Controller vê o prefixo, encaminha para o serviço da ponte.
3. Service da ponte enfileira `q:bridge.outbound:{user_id}` com o payload.
4. Worker consome, chama whatsmeow para enviar, captura o ID + recibos.
5. Recibos chegam de volta como eventos de entrada.

### Média

Média com ponte é descarregada pelo worker (via whatsmeow), re-cifrada com o mesmo esquema de envelope que a média nativa, e enviada para object storage. O cliente puxa por URL; o worker pode fazer streaming direto para payloads pequenos.

---

## Operacional

- **Um worker por utilizador ligado.** Locks Redis (`bridge:{user_id}:lock`) fixam workers; em falha o lease expira e outro nó assume.
- **Health checks** — worker publica heartbeats `bridge:{user_id}:status`; se ficar stale, a API mostra "ligação perdida".
- **Backpressure** — streams Redis são limitadas; se um worker não conseguir acompanhar, a API faz throttle do envio e informa o utilizador.
- **Reconexão** — workers retomam automaticamente do blob de sessão cifrado após reinício.

---

## Modelo de ameaça & divulgação ao utilizador

Fazer ponte de um protocolo E2E significa que **a ponte vê texto em claro** no salto da ponte. Somos explícitos:

1. O fluxo de ligação termina num ecrã "Como funciona a ponte WhatsApp", a explicar:
   - As mensagens WhatsApp são E2E *entre clientes WhatsApp*.
   - O worker da ponte é, por definição, um cliente WhatsApp — pode ler conteúdo.
   - O Socialize cifra e isola a sessão e os dados do worker, mas operadores com acesso total ao servidor poderiam em princípio ler mensagens com ponte.
   - Conversas Socialize nativas mantêm o E2E Signal intacto e **não** são afetadas.
2. O mesmo ecrã é alcançável a qualquer momento nas definições da ponte.
3. Dados da ponte ficam com o mesmo envelope encryption que a média, mas não beneficiam de E2E ponto-a-ponto.

Este é o mesmo compromisso que toda a ponte WhatsApp tem. O que muda é documentá-lo abertamente.

---

## Roadmap

- v0.1 — ligar, receber, enviar texto & média em 1:1.
- v0.2 — grupos, reações, recibos, "a escrever".
- v0.3 — Canais WhatsApp (leitura).
- v0.4 — paridade com mensagens efémeras, sync de contactos, leitura de status (story).
- v0.5 — paridade multi-dispositivo, propagação de edição / eliminação.

Issue de seguimento: **#30 [Backend] WhatsApp Integration via mautrix**.
