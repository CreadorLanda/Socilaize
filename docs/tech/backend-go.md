# 🦦 Go Backend

> Documentação da stack Go backend do Socialize.

---

## Visão Geral

O backend do Socialize é desenvolvido em Go 1.21+, utilizando frameworks modernos e práticas idiomaticas.

---

## 🛠️ Stack

| Componente | Library | Uso |
|------------|---------|-----|
| **HTTP** | Gin ou Echo | API REST |
| **gRPC** | gRPC/Proto | Inter-service |
| **DB** | GORM ou sqlx | PostgreSQL |
| **Cache** | go-redis | Redis |
| **Auth** | JWT | Autenticação |
| **Config** | Viper | Configuração |
| **Testing** | testify | Testes |

---

## 🗂️ Estrutura de Diretórios

```
server/
├── cmd/                      # Pontos de entrada
│   ├── auth-service/
│   ├── chat-service/
│   └── ...
├── internal/                # Código interno
│   ├── config/             # Configuração
│   ├── handler/           # HTTP handlers
│   ├── middleware/        # Middlewares
│   ├── repository/       # Data access
│   ├── service/         # Business logic
│   └── model/          # Models
├── pkg/                    # Pacotes compartilháveis
├── proto/                  # Proto files
├── go.mod
├── go.sum
└── Makefile
```

---

## 🏃 Padrão de Handler

```go
// internal/handler/user.go
type UserHandler struct {
    userService *service.UserService
}

func NewUserHandler(s *service.UserService) *UserHandler {
    return &UserHandler{userService: s}
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

## 📦 Padrão de Service

```go
// internal/service/user.go
type UserService struct {
    repo *repository.UserRepository
}

func NewUserService(repo *repository.UserRepository) *UserService {
    return &UserService{repo: repo}
}

func (s *UserService) GetByID(ctx context.Context, id string) (*model.User, error) {
    return s.repo.FindByID(ctx, id)
}
```

---

## 💾 Padrão de Repository

```go
// internal/repository/user.go
type UserRepository struct {
    db *gorm.DB
}

func NewUserRepository(db *gorm.DB) *UserRepository {
    return &UserRepository{db: db}
}

func (r *UserRepository) FindByID(ctx context.Context, id string) (*model.User, error) {
    var user model.User
    err := r.db.WithContext(ctx).First(&user, "id = ?", id).Error
    return &user, err
}
```

---

## 🔐 Middleware de Autenticação

```go
// internal/middleware/auth.go
func AuthMiddleware(jwtSecret string) gin.HandlerFunc {
    return func(c *gin.Context) {
        token := c.GetHeader("Authorization")
        if token == "" {
            c.JSON(401, gin.H{"error": "no token"})
            c.Abort()
            return
        }
        
        claims := &jwt.Claims{}
        _, err := jwt.ParseWithClaims(token, claims, func(token *jwt.Token) (interface{}, error) {
            return []byte(jwtSecret), nil
        })
        
        if err != nil {
            c.JSON(401, gin.H{"error": "invalid token"})
            c.Abort()
            return
        }
        
        c.Set("user_id", claims.UserID)
        c.Next()
    }
}
```

---

## 🔌 gRPC Service

```proto
// proto/user.proto
syntax = "proto3";

package pb;

service UserService {
    rpc GetUser(GetUserRequest) returns (User);
    rpc UpdateUser(UpdateUserRequest) returns (User);
}

message GetUserRequest {
    string id = 1;
}
```

```go
// cmd/user-service/main.go
func main() {
    lis, _ := net.Listen("tcp", ":50051")
    
    server := grpc.NewServer()
    pb.RegisterUserServiceServer(server, &userServer{})
    
    server.Serve(lis)
}
```

---

## ⚙️ Configuração

```go
// internal/config/config.go
type Config struct {
    Server   ServerConfig
    Database DatabaseConfig
    Redis    RedisConfig
    JWT      JWTConfig
}

type ServerConfig struct {
    Port string
    Mode string
}

// Load from env/flags
var cfg Config
viper.Decode(&cfg)
```

---

## ✅ Validação

```go
// internal/validator/user.go
type CreateUserRequest struct {
    Phone       string `json:"phone" validate:"required,e164"`
    Password   string `json:"password" validate:"required,min=8"`
    DisplayName string `json:"display_name" validate:"required,max=100"`
}

func Validate(r interface{}) error {
    return validator.New().Struct(r)
}
```

---

## 🧪 Testing

```go
// internal/service/user_test.go
func TestGetUser(t *testing.T) {
    // Setup
    db := dbtest.Setup(t)
    repo := repository.NewUserRepository(db)
    service := NewUserService(repo)
    
    // Test
    user, err := service.GetByID(context.Background(), "123")
    
    // Assert
    assert.NoError(t, err)
    assert.Equal(t, "123", user.ID)
}
```

---

## 🚀 Makefile

```makefile
.PHONY: build run test proto

build:
    go build -o bin/server ./cmd/server

run:
    go run ./cmd/server

test:
    go test -v ./...

proto:
    protoc --go_out=. --go-grpc_out=. proto/*.proto
```

---

## 📚 Referências

- [Arquitetura](./architecture.md)
- [Database](./database.md)