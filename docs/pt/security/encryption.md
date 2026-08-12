# 🔐 Encriptação

> Mensagens focadas em segurança significa **o servidor não consegue ler mensagens, mesmo se comprometido.** Três camadas — em trânsito, ponta-a-ponta, em repouso — funcionam juntas para que isto se sustente na prática, não só nos slides.

---

## Em trânsito

- Apenas TLS 1.3. TLS 1.2 desativado.
- Pinning de certificado nos clientes móveis (rotação via canal de atualização assinado).
- HSTS + Strict-Transport-Security com preload nas origens web.
- Tráfego interno entre API e workers da ponte usa mTLS.

---

## Ponta-a-ponta (X25519 / TweetNaCl próprio)

> **Isto não é o Signal Protocol.** Uma versão anterior deste documento dizia
> que era, e que o projeto usava `libsignal`. Nunca foi verdade — essa
> biblioteca não aparece em manifesto nenhum, nem no cliente nem no servidor. O
> que se segue descreve o que o código faz.

A cifra acontece no dispositivo com [TweetNaCl](https://tweetnacl.js.org/)
(`mobile/data/crypto/`). O servidor guarda texto cifrado e não tem material de
chaves.

### Chaves

| Tipo               | Duração                  | Para quê                                     |
|--------------------|--------------------------|----------------------------------------------|
| Identity key       | Longa, por dispositivo   | Fixa a identidade do dispositivo             |
| Signed pre-key     | Enviada por dispositivo  | Permite abrir sessão contigo offline         |
| One-time pre-keys  | Em lote, uso único       | Consumidas ao abrir sessão                   |
| Chave de grupo     | Por grupo e época        | Distribuição em leque após troca emparelhada |

### Envelopes

Dois formatos, ambos `prefixo.cabeçalho.corpo` em base64url:

- `soc1.` — direto. Cabeçalho com `v`, `ik` (identidade do remetente), `n`
  (contador), mais campos de aperto de mão nas primeiras mensagens.
- `soc1g.` — grupo. Cabeçalho com `v`, `s` (UUID do remetente), `e` (época), `n`.

O servidor valida **apenas a forma** — nunca abre o corpo, nunca deriva chave,
nunca verifica MAC.

### O que esta construção não te dá

Dito com todas as letras, porque a versão anterior desta página prometia as três:

- **Não há Double Ratchet.** Há um contador monotónico a que o código chama
  "simple ratchet". Ordena mensagens e deteta repetições. Não troca chave a
  cada mensagem.
- **Não há sigilo futuro** digno do nome. Comprometer a chave de longa duração
  de um dispositivo expõe as mensagens passadas que esse dispositivo ainda
  consegue decifrar.
- **Não há segurança pós-compromisso.** Não existe mecanismo que cure uma
  sessão depois de uma fuga de chave.

### Sem auditoria

Não houve revisão independente. A construção foi escrita para este projeto. Se
precisas das propriedades que o Signal dá, usa o Signal — isto é um messenger
honesto, não um equivalente.

Melhorar isto é [trabalho em aberto](https://github.com/CreadorLanda/Socilaize/issues),
não um estado assente.

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

## Pontes

Não há nenhuma, e não vai haver. Uma ponte tem de decifrar para traduzir, o que
põe um servidor em posição de ler mensagens — a única coisa que este documento
diz que nunca acontece.

A ponte do WhatsApp rejeitada e o raciocínio completo estão em
[decisions/0001](../../decisions/0001-no-whatsapp-bridge.md).

---

## Rotação de chaves

| Material                   | Rotação                            |
|----------------------------|------------------------------------|
| Identity key (dispositivo) | Vida do dispositivo                |
| Signed pre-key             | A cada 7 dias                      |
| One-time pre-keys          | Consumidas continuamente; cliente repõe quando baixo |
| Session keys               | Não rodam por mensagem — ver acima |
| Refresh tokens             | A cada uso                         |
| Server KEK (Vault/KMS)     | Anualmente, ou em incidente        |
| Backup KEK                 | Anualmente                         |
| Certificados TLS           | 90 dias (ACME automatizado)        |

---

## O que *não* está protegido

Dizemos em voz alta para ninguém ser apanhado de surpresa:

- **Metadados.** O servidor vê quem fala com quem e quando. Mitigações estilo sealed-sender estão no seguimento.
- **Um dispositivo comprometido enquanto desbloqueado.** Quem tem o telefone desbloqueado pode ler tudo; SQLCipher não defende disso.

Qualquer coisa para além desta lista deve ser reportada como bug, não como feature.
