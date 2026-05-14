# 📡 API Specifications

> Documentation for Socialize APIs.

---

## Authentication

### POST /auth/register

Register new user.

```json
// Request
{
  "phone": "+5511999999999",
  "password": "password123",
  "display_name": "John Doe"
}

// Response
{
  "user": {"id": "uuid", "phone": "+5511999999999"},
  "token": "jwt_token"
}
```

### POST /auth/login

Login.

```json
// Request
{
  "phone": "+5511999999999",
  "password": "password123"
}
```

---

## Messages

### POST /chats/:id/messages

Send message.

```json
// Request
{
  "content": "Hello! 👋",
  "content_type": "text"
}

// Response
{
  "id": "message_uuid",
  "content": "Hello! 👋",
  "created_at": "2024-01-01T00:00:00Z"
}
```

---

## WebSocket Events

### Connection

```
WS /ws?token=jwt_token
```

### Events

| Event | Payload |
|-------|---------|
| `message.new` | `{chat_id, message}` |
| `typing.start` | `{chat_id, user_id}` |
| `typing.stop` | `{chat_id, user_id}` |

---

## Error Codes

| Code | Description |
|------|-------------|
| 400 | Bad Request |
| 401 | Unauthorized |
| 404 | Not Found |
| 500 | Internal Error |

---

## References

- [Architecture](./architecture.md)
- [Database](./database.md)