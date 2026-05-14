# 🏗️ Arquitetura de Microservices

> Documentação da arquitetura de microservices do Socialize.

---

## Visão Geral da Arquitetura

O Socialize é construído usando uma arquitetura de microservices em Go, projetada para escalabilidade, disponibilidade e manutenibilidade.

---

## 🎯 Princípios Arquiteturais

| Princípio | Descrição |
|----------|----------|
| **Single Responsibility** | Cada serviço faz uma coisa bem feita |
| **Loose Coupling** | Serviços se comunicam via APIs |
| **High Cohesion** | Funcionalidades relacionadas no mesmo serviço |
| **Scalability** | Escala horizontal |
| **Resilience** | Tolerância a falhas |

---

## 📦 Microservices

### Serviços Core

```
┌─────────────────────────────────────────────────────────────┐
│                     API Gateway                              │
│                   (nginx / Traefik)                        │
└─────────────────────────────────────────────────────────────┘
                              │
        ┌─────────────────────┼─────────────────────┐
        ▼                   ▼                   ▼
┌──────────────┐    ┌──────────────┐    ┌──────────────┐
│ Auth Service │    │ Chat Svc    │    │ User Service │
│   (Port 3001)│    │ (Port 3002) │    │  (Port 3003)│
└──────────────┘    └──────────────┘    └──────────────┘
        │                   │                   │
        ▼                   ▼                   ▼
┌──────────────┐    ┌──────────────┐    ┌──────────────┐
│ Media Svc    │    │ Group Svc    │    │ Notif Svc   │
│ (Port 3004)  │    │ (Port 3005)  │    │  (Port 3006)│
└──────────────┘    └──────────────┘    └──────────────┘
        │                   │                   │
        ▼                   ▼                   ▼
┌──────────────┐    ┌──────────────┐    ┌──────────────┐
│ AI Service   │    │ Channel Svc │    │ Theme Svc   │
│ (Port 3007) │    │ (Port 3008) │    │  (Port 3009)│
└──────────────┘    └──────────────┘    └──────────────┘
```

### Descrição dos Serviços

| Serviço | Função | Dependências |
|---------|-------|-------------|
| **Auth Service** | Autenticação, JWT,OAuth | PostgreSQL, Redis |
| **Chat Service** | Mensagens, WebSocket | PostgreSQL, Redis |
| **User Service** | Perfis,-contatos | PostgreSQL, MongoDB |
| **Media Service** | Upload,processamento | S3, FFmpeg |
| **Group Service** | Grupos,canais | PostgreSQL |
| **Notification Service** | Push, email | Redis, FCM, APNs |
| **AI Service** | Dandara AI | OpenAI API |
| **Channel Service** | Canais públicos | PostgreSQL |
| **Theme Service** | Temas,customização | MongoDB |

---

## 🔌 Comunicação Inter-Serviços

### gRPC

Usamos gRPC para comunicação entre serviços:

```protobuf
// chat.proto
syntax = "proto3";

package chat;

service ChatService {
  rpc SendMessage(MessageRequest) returns (MessageResponse);
  rpc GetMessages(GetMessagesRequest) returns (Messages);
  rpc StreamMessages(StreamRequest) returns (stream Message);
}

message MessageRequest {
  string from = 1;
  string to = 2;
  MessageContent content = 3;
}
```

### Eventos (Async)

Para comunicação assíncrona, usamos um message broker:

```
┌─────────┐      ┌─────────┐      ┌─────────┐
│ Producer│─────▶│ Broker │─────▶│Consumer│
└─────────┘      └─────────┘      └─────────┘
                      │
                 ┌────────┐
                 │ Redis │
                 │ Kafka │
                 │NATS  │
                 └──────┘
```

### Event Types

| Event | descrição |
|-------|---------|
| `message.sent` | Nova mensagem |
| `message.delivered` | Mensagem entregue |
| `message.read` | Mensagem lida |
| `user.online` | Usuário online |
| `user.offline` | Usuário offline |
| `group.created` | Grupo criado |

---

## 🔀 API Gateway

### Funções

- **Routing** - Rotear requisições para serviços
- **Auth** - Validar tokens JWT
- **Rate Limiting** - Limitar requisições
- **Load Balancing** - Distribuir carga
- **Caching** - Cache de respostas
- **Logging** - Log de requisições

### Tech Stack

```yaml
# nginx.conf ou traefik.yaml
services:
  api_gateway:
    image: nginx:alpine
    ports:
      - "80:80"
      - "443:443"
```

---

## 📊 Database Architecture

### Polyglot Persistence

```
┌──────────────────┐
│  PostgreSQL      │
│  (Core Data)    │
│  - Users       │
│  - Messages    │
│  - Groups     │
└──────────────────┘
        │
        ▼
┌──────────────────┐      ┌──────────────────┐
│   MongoDB      │      │     Redis       │
│ (Documents)   │      │    (Cache)     │
│ - Profiles    │      │ - Sessions     │
│ - Themes     │      │ - Rate Limits  │
│ - Settings   │      │ - Real-time    │
└──────────────────┘      └──────────────────┘
```

---

## 🔄 Data Flow

### Send Message Flow

```
User A                Server                  User B
  │                     │                      │
  │──── POST /msg ──────▶│                      │
  │                     │                      │
  │                [Validate]                   │
  │                [Store DB]                 │
  │                [Cache]                   │
  │                [Event]────────────────▶│
  │                     │                      │
  │                     │                 [Deliver]
  │◀─── 200 OK ──────│                      │
  │                     │                      │
```

---

## 📈 Escalabilidade

### Horizontal Scaling

Cada serviço pode ser replicado:

```yaml
# kubernetes deployment
apiVersion: apps/v1
kind: Deployment
metadata:
  name: chat-service
spec:
  replicas: 3
  selector:
    matchLabels:
      app: chat-service
  template:
    spec:
      containers:
      - name: chat
        image: socialize/chat-service:latest
```

### Auto-Scaling

```yaml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: chat-service-hpa
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: chat-service
  minReplicas: 2
  maxReplicas: 10
  metrics:
  - type: Resource
    resource:
      name: cpu
      target:
        type: Utilization
        averageUtilization: 70
```

---

## 🛡️ Resiliência

### Circuit Breaker

```go
// go.mod
import "github.com/sony/gobreaker"

// Configuração
cb := gobreaker.NewCircuitBreaker(gobreaker.Settings{
    Name:        "auth-service",
    MaxRequests: 3,
    Interval:   10,
    Timeout:    30,
})
```

### Retry Logic

```go
// Retry com backoff
backoff := wait.NewExponentialBackoff(
    100*time.Millisecond,
    10*time.Second,
    2.0,
)
```

### Health Checks

```go
// Health endpoint
router.GET("/health", func(c *gin.Context) {
    // Check dependencies
    db. Ping()
    redis.Ping()
    
    c.JSON(200, gin.H{"status": "healthy"})
})
```

---

## 📝 Logging & Monitoring

### Distributed Tracing

```
Jaeger │ Zipkin │ Tempo
```

### Metrics

```
Prometheus + Grafana
```

### Logs

```
ELK Stack (Elasticsearch, Logstash, Kibana)
```

---

## 🌐 Service Mesh

### Istio

Para comunicação entre serviços:

```yaml
apiVersion: networking.istio.io/v1alpha3
kind: VirtualService
metadata:
  name: chat-service
spec:
  hosts:
  - chat-service
  http:
  - match:
    - headers:
        runtime:
          exact: production
    route:
    - destination:
        host: chat-service
        subset: v1
```

---

## 📚 Referências

- [Database Schema](./database.md)
- [API Reference](./api.md)
- [Backend Go](./backend-go.md)
- [Infrastructure](./infrastructure.md)