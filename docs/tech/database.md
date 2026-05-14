# 💾 Database

## PostgreSQL (Core)

```sql
CREATE TABLE users (
    id UUID PRIMARY KEY,
    phone VARCHAR(20) UNIQUE,
    username VARCHAR(50) UNIQUE,
    username_discoverable BOOLEAN DEFAULT TRUE,
    display_name VARCHAR(100),
    created_at TIMESTAMP DEFAULT NOW()
);
```

## MongoDB (Documents)
User settings, themes

## Redis (Cache)
Sessions, online status, typing indicators
