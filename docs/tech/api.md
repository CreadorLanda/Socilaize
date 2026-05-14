# 📡 API Specifications

> Documentação das APIs do Socialize.

---

## Visão Geral

O Socialize expõe APIs RESTful e WebSocket para comunicação.

---

## 🔐 Autenticação

### POST /auth/register

Registrar novo usuário.

```json
// Request
{
  "phone": "+5511999999999",
  "password": "senha123",
  "display_name": "João Silva",
  "device_id": "device_123"
}

// Response
{
  "user": {
    "id": "uuid",
    "phone": "+5511999999999",
    "display_name": "João Silva"
  },
  "token": "jwt_token_aqui",
  "refresh_token": "refresh_token_aqui"
}
```

### POST /auth/login

Login de usuário.

```json
// Request
{
  "phone": "+5511999999999",
  "password": "senha123",
  "device_id": "device_123"
}

// Response
{
  "user": {...},
  "token": "jwt_token",
  "refresh_token": "refresh_token"
}
```

### POST /auth/refresh

Atualizar token.

```json
// Request
{
  "refresh_token": "refresh_token_aqui"
}

// Response
{
  "token": "novo_token",
  "refresh_token": "novo_refresh"
}
```

### POST /auth/logout

Logout.

```json
// Request
{
  "token": "token_a_invalidar"
}
```

---

## 👤 Usuários

### GET /users/me

Pegar dados do usuário atual.

```json
// Response
{
  "id": "uuid",
  "username": "joao_silva",
  "display_name": "João Silva",
  "avatar_url": "https://...",
  "bio": "Olá!",
  "status": "online"
}
```

### PUT /users/me

Atualizar perfil.

```json
// Request
{
  "display_name": "João Atualizado",
  "bio": "Nova bio",
  "avatar_url": "https://..."
}
```

### GET /users/:id

Pegar dados de outro usuário.

### GET /users/search

Buscar usuários.

```json
// GET /users/search?q=joao&limit=20

// Response
{
  "users": [
    {"id": "uuid", "username": "joao", "display_name": "João"}
  ]
}
```

---

## 💬 Mensagens

### GET /chats/:id/messages

Buscar mensagens.

```json
// GET /chats/chat_uuid/messages?before=message_uuid&limit=50

// Response
{
  "messages": [...],
  "has_more": true
}
```

### POST /chats/:id/messages

Enviar mensagem.

```json
// Request
{
  "content": "Olá! 👋",
  "content_type": "text"
}

// Response
{
  "id": "message_uuid",
  "chat_id": "chat_uuid",
  "sender_id": "user_uuid",
  "content": "Olá! 👋",
  "created_at": "2024-01-01T00:00:00Z"
}
```

### PUT /messages/:id

Editar mensagem.

```json
// Request
{
  "content": "Nova mensagem!"
}
```

### DELETE /messages/:id

Excluir mensagem.

```json
// Request
{
  "delete_for": "all" // or "me"
}
```

### POST /messages/:id/reactions

Adicionar reação.

```json
// Request
{
  "reaction": "❤️"
}
```

---

## 👥 Grupos

### POST /groups

Criar grupo.

```json
// Request
{
  "name": "Meu Grupo",
  "participants": ["user_id_1", "user_id_2"]
}
```

### GET /groups/:id

Dados do grupo.

```json
// Response
{
  "id": "group_uuid",
  "name": "Meu Grupo",
  "participants": [...],
  "settings": {...}
}
```

### PUT /groups/:id/settings

Atualizar configurações.

```json
// Request
{
  "name": "Novo Nome",
  "description": "Descrição"
}
```

### POST /groups/:id/participants

Adicionar participante.

```json
// Request
{
  "user_ids": ["user_id"]
}
```

---

## 📢 Canais

### GET /channels

Listar canais públicos.

```json
// GET /channels?category=tech&limit=20

// Response
{
  "channels": [...]
}
```

### POST /channels

Criar canal.

```json
// Request
{
  "name": "meu-canal",
  "description": "Canal legal",
  "is_public": true
}
```

---

## 🔔 Notificações

### GET /notifications

Listar notificações.

```json
// GET /notifications?unread=true

// Response
{
  "notifications": [...],
  "unread_count": 5
}
```

### PUT /notifications/:id/read

Marcar como lida.

---

## WebSocket Events

### Conexão

```
WS /ws?token=jwt_token
```

### Eventos de Mensagem

| Event | Payload |
|-------|---------|
| `message.new` | `{chat_id, message}` |
| `message.update` | `{message_id, changes}` |
| `message.delete` | `{message_id}` |

### Eventos de Presença

| Event | Payload |
|-------|---------|
| `user.online` | `{user_id}` |
| `user.offline` | `{user_id}` |
| `typing.start` | `{chat_id, user_id}` |
| `typing.stop` | `{chat_id, user_id}` |

### Eventos de Grupo

| Event | Payload |
|-------|---------|
| `participant.join` | `{group_id, user_id}` |
| `participant.leave` | `{group_id, user_id}` |

---

## Códigos de Erro

| Código | Descrição |
|--------|----------|
| 400 | Bad Request |
| 401 | Unauthorized |
| 403 | Forbidden |
| 404 | Not Found |
| 429 | Too Many Requests |
| 500 | Internal Error |

---

## Rate Limits

| Endpoint | Limite |
|----------|-------|
| /auth/* | 10/min |
| /messages | 60/min |
| /uploads | 10/min |

---

## Referências

- [Arquitetura](./architecture.md)
- [Database](./database.md)