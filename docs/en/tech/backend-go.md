# 🦦 Go Backend

> Documentation for Socialize Go backend.

---

## Overview

Socialize backend is developed in Go 1.21+ using modern frameworks and idiomatic practices.

---

## Stack

| Component | Library | Use |
|------------|---------|-----|
| **HTTP** | Gin or Echo | REST API |
| **gRPC** | gRPC/Proto | Inter-service |
| **DB** | GORM or sqlx | PostgreSQL |
| **Cache** | go-redis | Redis |
| **Auth** | JWT | Authentication |
| **Config** | Viper | Configuration |

---

## Directory Structure

```
server/
├── cmd/                      # Entry points
│   ├── auth-service/
│   ├── chat-service/
│   └── ...
├── internal/                # Internal code
│   ├── config/             # Configuration
│   ├── handler/           # HTTP handlers
│   ├── middleware/        # Middlewares
│   ├── repository/       # Data access
│   ├── service/         # Business logic
│   └── model/          # Models
├── pkg/                    # Shared packages
├── proto/                  # Proto files
└── Makefile
```

---

## Handler Pattern

```go
type UserHandler struct {
    userService *service.UserService
}

func (h *UserHandler) GetUser(c *gin.Context) {
    id := c.Param("id")
    
    user, err := h.userService.GetByID(c.Request.Context(), id)
    if err != nil {
        c.JSON(404, gin.H{"error": "user not found"})
        return
    }
    
    c.JSON(200, user)
}
```

---

## References

- [Architecture](./architecture.md)
- [Database](./database.md)