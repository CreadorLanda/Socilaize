# 💾 Especificação de Database

> Documentação dos schemas de banco de dados do Socialize.

---

## Visão Geral

O Socialize usa uma arquitetura de polyglot persistence com PostgreSQL, MongoDB e Redis.

---

## 🐘 PostgreSQL (Dados Core)

### Schema de Usuários

```sql
-- Users table
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    phone VARCHAR(20) UNIQUE,
    email VARCHAR(255) UNIQUE,
    username VARCHAR(50) UNIQUE,
    username_discoverable BOOLEAN DEFAULT TRUE,
    password_hash VARCHAR(255),
    display_name VARCHAR(100),
    avatar_url TEXT,
    bio TEXT,
    status VARCHAR(50) DEFAULT 'offline',
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    last_seen_at TIMESTAMP,
    is_verified BOOLEAN DEFAULT FALSE,
    is_premium BOOLEAN DEFAULT FALSE,
    settings JSONB DEFAULT '{}',
    metadata JSONB DEFAULT '{}'
);

CREATE INDEX idx_users_phone ON users(phone);
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_username ON users(username);
CREATE INDEX idx_users_username_discoverable ON users(username) WHERE username_discoverable = TRUE;
CREATE INDEX idx_users_status ON users(status);
```

### Schema de Mensagens

```sql
-- Messages table
CREATE TABLE messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    chat_id UUID NOT NULL,
    sender_id UUID NOT NULL REFERENCES users(id),
    content TEXT,
    content_type VARCHAR(20) DEFAULT 'text',
    media_url TEXT,
    media_type VARCHAR(50),
    media_size INTEGER,
    reply_to_id UUID,
    is_edited BOOLEAN DEFAULT FALSE,
    is_deleted BOOLEAN DEFAULT FALSE,
    is_pinned BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT NOW(),
    delivered_at TIMESTAMP,
    read_at TIMESTAMP,
    metadata JSONB DEFAULT '{}'
);

CREATE INDEX idx_messages_chat ON messages(chat_id, created_at DESC);
CREATE INDEX idx_messages_sender ON messages(sender_id);
CREATE INDEX idx_messages_reply ON messages(reply_to_id);
CREATE INDEX idx_messages_created ON messages(created_at DESC);
```

### Schema de Chats

```sql
-- Chats table
CREATE TABLE chats (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    type VARCHAR(20) DEFAULT 'direct', -- 'direct', 'group', 'channel'
    title VARCHAR(100),
    avatar_url TEXT,
    created_by UUID NOT NULL REFERENCES users(id),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    last_message_id UUID,
    last_message_at TIMESTAMP,
    settings JSONB DEFAULT '{}'
);

CREATE INDEX idx_chats_type ON chats(type);
CREATE INDEX idx_chats_created_by ON chats(created_by);
CREATE INDEX idx_chats_last_message ON chats(last_message_at DESC);
```

### Schema de Participantes

```sql
-- Chat participants
CREATE TABLE chat_participants (
    chat_id UUID NOT NULL REFERENCES chats(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role VARCHAR(20) DEFAULT 'member', -- 'owner', 'admin', 'moderator', 'member'
    joined_at TIMESTAMP DEFAULT NOW(),
    last_read_at TIMESTAMP,
    notifications VARCHAR(20) DEFAULT 'all',
    is_muted BOOLEAN DEFAULT FALSE,
    PRIMARY KEY (chat_id, user_id)
);

CREATE INDEX idx_participants_user ON chat_participants(user_id);
CREATE INDEX idx_participants_role ON chat_participants(role);
```

### Schema de Autenticação

```sql
-- Sessions table
CREATE TABLE sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token TEXT NOT NULL,
    device_id TEXT,
    device_name TEXT,
    ip_address INET,
    user_agent TEXT,
    expires_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    last_used_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_sessions_token ON sessions(token);
CREATE INDEX idx_sessions_user ON sessions(user_id);
CREATE INDEX idx_sessions_expires ON sessions(expires_at);
```

---

## 🍃 MongoDB (Documentos)

### Collections de Configurações

```javascript
// user_settings collection
{
  "_id": ObjectId,
  "user_id": "uuid",
  "theme": {
    "mode": "dark",
    "accent_color": "#007AFF",
    "font": "Poppins"
  },
  "privacy": {
    "last_seen": "contacts",
    "online_status": "all",
    "typing_status": "all"
  },
  "notifications": {
    "sound": true,
    "vibration": true,
    "message_preview": true
  },
  "created_at": ISODate,
  "updated_at": ISODate
}
```

### Collections de Temas

```javascript
// themes collection
{
  "_id": ObjectId,
  "name": "Ocean Blue",
  "creator_id": "uuid",
  "is_public": true,
  "downloads": 1000,
  "theme_data": {
    "colors": {
      "primary": "#007AFF",
      "secondary": "#5856D6",
      "background": "#000000"
    },
    "effects": {
      "glassmorphism": true,
      "neon": false
    }
  },
  "created_at": ISODate
}
```

### Collections de Stories

```javascript
// stories collection
{
  "_id": ObjectId,
  "user_id": "uuid",
  "media_url": "https://...",
  "media_type": "image",
  "caption": "My story",
  "views": ["uuid1", "uuid2"],
  "expires_at": ISODate,
  "created_at": ISODate
}
```

---

## 🟢 Redis (Cache & Real-time)

### Keys& Estruturas

```redis
# User online status
USER:ONLINE:{user_id} = "true" | "false"
USER:LASTSEEN:{user_id} = timestamp

# Active connections
USER:CONNECTIONS:{user_id} = [connection_ids]

# Chat typing status
CHAT:TYPING:{chat_id}:{user_id} = timestamp

# Online users (Set)
SET:ONLINE:USERS = [user_ids]

# Rate limiting
RATE:LIMIT:{user_id}:{action} = count

# Session cache
SESSION:{token} = user_id
```

### Pub/Sub Channels

```
CHAT:MESSAGES:{chat_id}    # Mensagens em tempo real
USER:PRESENCE:{user_id}     # Status de presença
NOTIFICATION:PUSH          # Push notifications
```

---

## 🔐 Backup & Recovery

### Estratégia de Backup

| Tipo | Frequência | Retenção |
|------|-----------|---------|
| Full | Diário | 30 dias |
| Incremental | A cada 6h | 7 dias |
| WAL/Binlog | Contínuo | 30 dias |
| MongoDB | Diário | 30 dias |
| Redis RDB | A cada 1h | 7 dias |

### Recovery Procedures

```bash
# Restore PostgreSQL
pg_restore -d socialize backup.dump

# Restore MongoDB
mongorestore --db socialize backup/

# Restore Redis
redis-cli --rdb backup.rdb
```

---

## 📈 Referências

- [Arquitetura](./architecture.md)
- [API Reference](./api.md)