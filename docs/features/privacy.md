# 🔒 Privacidade

> Documentação das funcionalidades de privacidade do Socialize.

---

## Visão Geral

Socialize oferece controle granular sobre sua privacidade. Todas as configurações são criptografadas localmente.

---

## 👻 Modo Ghost

### Visão Geral

O Modo Ghost permite usar o Socialize completamente invisible.其他人无法知道你在线或已阅读他们的消息。

### Ativar Modo Ghost

1. Configurações
2. Privacidade
3. Modo Ghost
4. Ativar

### Configurações

```typescript
interface GhostModeSettings {
  enabled: boolean;
  hideOnline: boolean;
  hideTyping: boolean;
  hideRecording: boolean;
  hideLastSeen: boolean;
  hideReadReceipts: boolean;
  hideStoryView: boolean;
  hidePresence: boolean;
}
```

### Níveis de Ghost

| Nível | O que fica oculto |
|------|-----------------|
| 🔵 Leve | Visto por último |
| 🟡 Médio | Online + Digitando |
| 🔴 Total | Tudo = invisível total |

### Uso Responsável

> ⚠️ Modo Ghost deve ser usado com responsabilidade

---

## 🔐 Bloqueio de App

### Ativar Bloqueio

1. Configurações → Segurança
2. Bloqueio de App
3. Escolha método:
   - PIN (4-6 dígitos)
   - Padrão
   - Biometria
   - fingerprint

### Configurações

```typescript
interface AppLockSettings {
  enabled: boolean;
  method: 'pin' | 'pattern' | 'biometric';
  autoLockTimeout: number; // minutos
  lockOnBackground: boolean;
  showContent: boolean; // mostra prévia
}
```

---

## 💬 Bloqueio de Chat

### Bloquear Conversa

1. Abra a conversa
2. Toque no nome
3. Configurações → Bloquear
4. Confirme

### Recursos

- Mensagens ocultas da lista
- Requer autenticação para acessar
- Pode ter PIN отдельный

---

## 👁️ Controle de "Visto Por Último"

### Configurações

| Opção | Descrição |
|-------|-----------|
| Todos | Qualquer um pode ver |
| Meus contatos | Apenas contatos |
| Ninguém | Invisível |

### Congelar "Visto Por Último"

Em "Configurações avançadas", você pode:
- Congelar para um contato específico
- Congelar permanentemente
- Schedule (ex:只在工作时)

---

## 🎭 Anti-Delete de Mensagens

### O que faz?

Quando enabled, mensagens NÃO são excluídas mesmo quando o remetente tenta deletá-las.

### Ativar

1. Configurações → Privacidade
2. Anti-Delete
3. Ativar

### Limite

- Armazena até 1.000 mensagens por chat
- Período: 30 dias (configurável)

---

## 🚫 Lista de Bloqueio

### Bloquear Usuário

1. Perfil do usuário
2. Bloquear
3. Confirme

### Gerenciar Bloqueados

- Lista visível apenas para você
- Não recebe notificações
- Não pode te adicionar

### Exportar/Importar

```bash
# Exportar lista
/socialize export-blocklist

# Importar
/socialize import-blocklist --file=blocklist.json
```

---

## 🔏 Autenticação Biométrica

### Biometria Suportada

- Impressão digital
- Face ID
- Iris

### Configurações

```typescript
interface BiometricSettings {
  enabled: boolean;
  requiredFor:
    | 'none'
    | 'app'
    | 'sensitive'
    | 'all';
  fallbackToPIN: boolean;
}
```

---

## 🔒 Criptografia de Ponta-a-Ponta (E2E)

### Como Funciona

1. Cada usuário tem chave privada única
2. Mensagens são criptografadas antes do envio
3. Apenas destinatário pode descriptografar
4. Servidor NON pode ler mensagens

### Verificar Segurança

1. Abra conversa
2. Toque no nome
3. Criptografia
4. Escaneie QR code do contato

---

## 🕵️ Modo Anônimo

### Recursos

Use um identificador diferente:
- Nome anónimo
- Avatar público
- Sem informações pessoais

### Configurar

```typescript
interface AnonymousProfile {
  displayName: string;
  avatar: string;
  bio: string;
  // Não mostra:
  // - Número de telefone
  // - Email
  // - Última vez online
}
```

---

## 🔇 Silenciar Status

### Silenciar Status de Usuário

- Não mostrar quando está online
- Não mostrar "digitando"
- Não mostrar "gravando"

---

## 📱 Controle de Dados

### Dados Coletados

| Dado |armazenado por | Compartilhado |
|-----|----------------|----------------|
| Número | Criptografado | Não |
| Mensagens | Voc decides | Não |
| Metadados | 90 dias | Aggregated |
| Device info | 1 ano | Não |

### Excluir Dados

A qualquer momento, solicite:
- 📥 Exportar meus dados
- 🗑️ Deletar minha conta
- 🚫 Revogar consentimento

---

## ⚠️ Alertas de Segurança

### Notificações de Login

Receba alertas quando:
- Novo dispositivo acessou
- Nova localização
- Alteração de segurança

---

## Referências

- [Especificação de Criptografia](../security/encryption.md)
- [Política de Privacidade](../security/privacy-policy.md)