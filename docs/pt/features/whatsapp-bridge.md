# 🌉 Bridge WhatsApp

> Integração com WhatsApp via Evolution API.

---

## Visão Geral

| Recurso | Descrição |
|---------|-------------|
| **Conexão** | Conectar WhatsApp ao Socialize |
| **Mensagens** | Enviar/receber mensagens WhatsApp |
| **Sincronização** | Sincronização de contatos |
| **Mídia** | Transferência de imagem, vídeo, áudio |

---

## Arquitetura

```
Usuário Socialize ←→ API Socialize ←→ Evolution API ←→ WhatsApp
```

---

## Recursos

### 1. Conexão WhatsApp

- Pareamento por QR code
- Gerenciamento de sessão
- Suporte a múltiplos dispositivos

### 2. Bridge de Mensagens

| Direção | Descrição |
|----------|-------------|
| WA → Socialize | Receber mensagens WhatsApp no app |
| Socialize → WA | Enviar do app para WhatsApp |

### 3. Sincronização de Contatos

- Importar contatos WhatsApp
- Vincular a usuários Socialize

### 4. Manipulação de Mídia

- Download automático
- Encaminhar para chat
- Preservação de qualidade

---

## Endpoints API

```go
// Conexão
POST   /api/whatsapp/connect      // Iniciar pareamento
GET    /api/whatsapp/status       // Verificar conexão
DELETE /api/whatsapp/disconnect  // Desconectar

// Mensagens  
POST   /api/whatsapp/send        // Enviar para WhatsApp
GET    /api/whatsapp/chats       // Listar chats WhatsApp
GET    /api/whatsapp/messages    // Obter mensagens

// Configurações
PUT    /api/whatsapp/settings   // Configurar bridge
```
