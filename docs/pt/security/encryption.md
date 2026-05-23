# 🔐 Encriptação

> Mensagens focadas em segurança significa **o servidor não consegue ler mensagens, mesmo se comprometido.** Três camadas — em trânsito, ponta-a-ponta, em repouso — funcionam juntas para que isto se sustente na prática, não só nos slides.

---

## Em trânsito

- Apenas TLS 1.3. TLS 1.2 desativado.
- Pinning de certificado nos clientes móveis (rotação via canal de atualização assinado).
- HSTS + Strict-Transport-Security com preload nas origens web.
- Tráfego interno entre API e workers da ponte usa mTLS.

---

## Ponta-a-ponta (Signal Protocol)

Usamos libsignal — o mesmo protocolo por trás do Signal e do WhatsApp — exposto por bindings Go no servidor (apenas para gestão de pre-key bundles) e pelas bibliotecas móveis oficiais no cliente (onde acontecem cifrar/decifrar).

### Chaves

| Tipo de chave           | Tempo de vida                | Função                                                            |
|-------------------------|------------------------------|-------------------------------------------------------------------|
| Identity key            | Longa, por dispositivo       | Fixa a identidade, assina signed pre-keys                         |
| Signed pre-key          | Rotada a cada 7 dias         | Autentica o dispositivo, incluída em X3DH                         |
| One-time pre-keys       | Em batches, uso único        | Submetidas em lotes; consumidas no início de sessão               |
| Session keys            | Por chat                     | Derivadas por X3DH, rotacionadas via Double Ratchet               |
| Sender keys             | Por grupo                    | Usadas no fan-out de grupos após distribuição pairwise da chave   |

### Fluxos

- **X3DH** faz a primeira combinação de chaves quando dois dispositivos comunicam pela primeira vez.
- **Double Ratchet** rotaciona chaves de sessão a cada troca, dando forward secrecy e post-compromise security.
- **Sender Keys** tornam mensagens de grupo eficientes: o emissor partilha uma Sender Key com cada membro por canais pairwise, depois cifra cada mensagem de grupo uma vez.

### O que o servidor guarda

Só material **público** e envelopes *ciphertext* pendentes de entrega:

- Identity keys públicas, signed pre-keys (com assinaturas), one-time pre-keys.
- Envelopes de mensagens cifradas (tabela `message_envelopes`) — TTL curto, apagados no ack.

O servidor nunca tem:

- Chaves privadas (vivem nos dispositivos).
- Mensagens em claro.
- Média em claro.

### Verificação de identidade

- Dispositivos expõem um número de segurança de 60 dígitos por parceiro de chat.
- A UI mostra-o como cinco linhas de doze dígitos, com QR fallback para verificação presencial.
- Aviso quando a identity key de um parceiro muda; o utilizador tem de confirmar antes de continuar.

---

## Em repouso

### No servidor

- Ficheiros de dados Postgres: encriptação completa de disco no host (LUKS / encryption at rest gerida pela cloud).
- Colunas sensíveis (push tokens, blobs de sessão da ponte, refresh tokens): envelope-encrypted a nível aplicacional com uma KEK em KMS / Vault. As tabelas nunca veem claro.
- Object storage: cada ficheiro de média tem uma Data Encryption Key (DEK), embrulhada pela KEK. A DEK fica nos metadados do objeto; perder a KEK torna o storage ilegível.
- Backups: cifrados com uma KEK de backup separada, rotacionada independentemente.

### No dispositivo

- A SQLite é embrulhada por **SQLCipher** (AES-256-CBC, por página).
- A chave DB é gerada uma vez no primeiro arranque (256 bits), depois embrulhada pela keychain do SO:
  - iOS: Keychain com `kSecAttrAccessibleWhenUnlockedThisDeviceOnly`.
  - Android: Keystore (StrongBox onde disponível), wrap AES-GCM.
  - macOS / Windows / Linux: Keychain / DPAPI / libsecret.
- O arranque da app desbloqueia o item da keychain (com porta biométrica opcional) e abre a DB.
- Schema detalhado e ciclo de vida em [local-storage.md](../tech/local-storage.md).

---

## Autenticação & sessões

- Baseada em número de telefone, com códigos one-time entregues por SMS.
- Códigos de 6 dígitos, rate-limited por telefone e por IP, expiram em 5 minutos, uso único.
- Sucesso: JWT access token (curto, e.g. 15 min) + refresh token opaco (rotacionado a cada uso, family-tracked para detetar roubo).
- Tokens de sessão guardados como hash no servidor (`SHA-256`); só o portador tem o original.
- Logout invalida toda a família de refresh.

---

## Pontes e compromissos E2E

Fazer ponte do WhatsApp via mautrix parte o E2E do WhatsApp *no salto da ponte*: o worker é, por definição, um cliente WhatsApp e pode ler mensagens. Isolamos claramente:

- Dados da ponte vivem em tabelas separadas e passam por um code path separado.
- Blobs de sessão são envelope-encrypted em repouso.
- O fluxo de ligação obriga o utilizador a aceitar o compromisso antes de completar.
- Conversas Socialize nativas *não* são afetadas — as suas sessões Signal continuam ponta-a-ponta.

Texto de divulgação completo e detalhes operacionais em [whatsapp-bridge.md](../tech/whatsapp-bridge.md#modelo-de-ameaça--divulgação-ao-utilizador).

---

## Rotação de chaves

| Material                   | Rotação                            |
|----------------------------|------------------------------------|
| Identity key (dispositivo) | Vida do dispositivo                |
| Signed pre-key             | A cada 7 dias                      |
| One-time pre-keys          | Consumidas continuamente; cliente repõe quando baixo |
| Session keys               | A cada mensagem (Double Ratchet)   |
| Refresh tokens             | A cada uso                         |
| Server KEK (Vault/KMS)     | Anualmente, ou em incidente        |
| Backup KEK                 | Anualmente                         |
| Certificados TLS           | 90 dias (ACME automatizado)        |

---

## O que *não* está protegido

Dizemos em voz alta para ninguém ser apanhado de surpresa:

- **Metadados.** O servidor vê quem fala com quem e quando. Mitigações estilo sealed-sender estão no seguimento.
- **Um dispositivo comprometido enquanto desbloqueado.** Quem tem o telefone desbloqueado pode ler tudo; SQLCipher não defende disso.
- **Side channels na ponte.** Tudo o que passa pela ponte WhatsApp é, nesse salto, acessível ao worker.

Qualquer coisa para além desta lista deve ser reportada como bug, não como feature.
