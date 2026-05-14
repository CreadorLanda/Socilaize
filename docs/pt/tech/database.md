# 💾 Banco de Dados

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

## MongoDB (Documentos)
Configurações de usuário, temas

## Redis (Cache)
Sessões, status online, indicadores de digitação
