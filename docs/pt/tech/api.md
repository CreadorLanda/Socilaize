# 📡 API

## Autenticação

### POST /auth/register
```json
{"phone": "+5511999999999", "password": "123", "display_name": "João"}
```

### POST /auth/login
```json
{"phone": "+5511999999999", "password": "123"}
```

## Usuários

### GET /users/search?q=username
Buscar usuários por username

### PUT /users/me/username
Atualizar configurabilidade do username
