# 💾 Database Specification

> Documentation for Socialize database schemas.

---

## Overview

Socialize uses a polyglot persistence architecture with PostgreSQL, MongoDB, and Redis.

---

## 🐘 PostgreSQL (Core Data)

### Users Schema

```sql
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    phone VARCHAR(20) UNIQUE,
    email VARCHAR(255) UNIQUE,
    username VARCHAR(50) UNIQUE,
    password_hash VARCHAR(255),
    display_name VARCHAR(100),
    avatar_url TEXT,
    bio TEXT,
    status VARCHAR(50) DEFAULT 'offline',
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    is_verified BOOLEAN DEFAULT FALSE,
    is_premium BOOLEAN DEFAULT FALSE
);
```

### Messages Schema

```sql
CREATE TABLE messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    chat_id UUID NOT NULL,
    sender_id UUID NOT NULL,
    content TEXT,
    content_type VARCHAR(20) DEFAULT 'text',
    created_at TIMESTAMP DEFAULT NOW(),
    delivered_at TIMESTAMP,
    read_at TIMESTAMP
);
```

---

## 🍃 MongoDB (Documents)

### User Settings Collection

```javascript
{
  "_id": ObjectId,
  "user_id": "uuid",
  "theme": {
    "mode": "dark",
    "accent_color": "#007AFF"
  },
  "privacy": {
    "last_seen": "contacts",
    "online_status": "all"
  }
}
```

---

## 🟢 Redis (Cache & Real-time)

```redis
# User online status
USER:ONLINE:{user_id} = "true" | "false"

# Chat typing status
CHAT:TYPING:{chat_id}:{user_id} = timestamp

# Online users (Set)
SET:ONLINE:USERS = [user_ids]
```

---

## References

- [Architecture](./architecture.md)
- [API Reference](./api.md)