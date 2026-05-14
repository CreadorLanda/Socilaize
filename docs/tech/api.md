# 📡 API

## Auth

### POST /auth/register
```json
{"phone": "+5511999999999", "password": "123", "display_name": "John"}
```

### POST /auth/login
```json
{"phone": "+5511999999999", "password": "123"}
```

## Users

### GET /users/search?q=username
Search users by username

### PUT /users/me/username
Update username discoverability
