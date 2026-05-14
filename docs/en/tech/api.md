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

// Optional: Create unique username
{
  "phone": "+5511999999999",
  "password": "password123",
  "display_name": "John Doe",
  "username": "johndoe",
  "username_discoverable": true  // Allow others to find by username
}

// Response
{
  "user": {
    "id": "uuid",
    "phone": "+5511999999999",
    "username": "johndoe",
    "username_discoverable": true
  },
  "token": "jwt_token"
}
```

### PUT /users/me/username

Update username settings (enable/disable discovery).

```json
// Request
{
  "username": "johndoe",
  "username_discoverable": true  // true = others can find you by username
}

// Response
{
  "username": "johndoe",
  "username_discoverable": true
}
```

### GET /users/search

Search users by username or display name.

```json
// GET /users/search?q=john

// Response
{
  "users": [
    {
      "id": "uuid",
      "username": "johndoe",
      "display_name": "John Doe",
      "username_discoverable": true
    }
  ]
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