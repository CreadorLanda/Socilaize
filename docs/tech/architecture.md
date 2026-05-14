# 🏗️ Architecture

> Complete documentation for Socialize microservices architecture.

---

## Overview

Socialize uses a **microservices architecture** designed for:
- **Scalability**: Scale individual services independently
- **Availability**: Fault isolation prevents cascade failures
- **Maintainability**: Teams can work on services independently
- **Deployability**: Services can be deployed independently

---

## System Architecture

```
                            ┌─────────────────┐
                            │   API Gateway   │
                            │ nginx/traefik   │
                            └────────┬────────┘
                                     │
           ┌─────────────────────────┼─────────────────────────┐
           │                         │                         │
           ▼                         ▼                         ▼
┌──────────────────┐      ┌──────────────────┐      ┌──────────────────┐
│  Auth Service    │      │   Chat Service   │      │  User Service    │
│    (Port 3001)   │      │    (Port 3002)   │      │    (Port 3003)   │
│                  │      │                  │      │                  │
│ - Login         │      │ - Messages       │      │ - Profiles       │
│ - Register     │      │ - Reactions     │      │ - Contacts      │
│ - JWT         │      │ - Read status   │      │ - Search       │
│ - Session      │      │ - Typing        │      │ - Settings     │
└────────┬───────┘      └────────┬───────┘      └────────┬───────┘
         │                       │                       │
         │───────────────────────┼───────────────────────┤
                             ▼ ▼
                    ┌────────────────────────┐
                    │    Message Broker   │
                    │    Redis/Kafka     │
                    └────────────────────────┘
                             │
         ┌───────────────────┼───────────────────┐
         │                   │                   │
         ▼                   ▼                   ▼
┌────────────────┐  ┌────────────────┐  ┌────────────────┐
│ Media Service   │  │  Group Service  │  │ Notif Service  │
│   (Port 3004)   │  │   (Port 3005)   │  │   (Port 3006)  │
│                │  │                │  │                │
│ - Upload       │  │ - Groups       │  │ - Push FCM     │
│ - Media proc   │  │ - Channels    │  │ - Email        │
│ - Thumbnails  │  │ - Members     │  │ - SMS          │
└────────────────┘  └────────────────┘  └────────────────┘
```

---

## Services Detail

### 1. Auth Service (Port 3001)

**Purpose**: Authentication and authorization

**Responsibilities**:
- User registration and login
- JWT token generation/validation
- Session management
- OAuth providers

**Endpoints**:
```go
POST   /auth/register     // Register new user
POST   /auth/login     // Login
POST   /auth/refresh  // Refresh token
POST   /auth/logout   // Logout
GET    /auth/me      // Get current user
```

**Database**: PostgreSQL
**Cache**: Redis

---

### 2. Chat Service (Port 3002)

**Purpose**: Real-time messaging

**Responsibilities**:
- Message storage/delivery
- Typing indicators
- Read receipts
- Reactions

**Endpoints**:
```go
POST   /chats                    // Create chat
GET    /chats/:id                // Get chat
POST   /chats/:id/messages       // Send message
GET    /chats/:id/messages      // Get messages
WS     /ws/chat                // WebSocket
```

**Database**: PostgreSQL + MongoDB
**Real-time**: WebSocket

---

### 3. User Service (Port 3003)

**Purpose**: User management

**Responsibilities**:
- User profiles
- Contact management
- User search
- Settings

**Endpoints**:
```go
GET    /users/:id              // Get profile
PUT    /users/me               // Update profile
GET    /users/search          // Search users
POST   /users/me/contacts     // Add contact
DELETE /users/me/contacts/:id // Remove contact
```

**Database**: PostgreSQL + MongoDB

---

### 4. Media Service (Port 3004)

**Purpose**: Media handling

**Responsibilities**:
- File upload/download
- Image/video processing
- Thumbnail generation
- CDNs

**Endpoints**:
```go
POST   /media/upload        // Upload file
GET    /media/:id          // Download file
POST   /media/:id/thumbnail // Generate thumbnail
DELETE /media/:id         // Delete media
```

**Storage**: S3/MinIO
**Processing**: FFmpeg, Sharp

---

### 5. Group Service (Port 3005)

**Purpose**: Group management

**Responsibilities**:
- Create/manage groups
- Member management
- Group settings
- Permissions

**Endpoints**:
```go
POST   /groups                    // Create group
GET    /groups/:id               // Get group
PUT    /groups/:id                // Update group
POST   /groups/:id/members       // Add member
DELETE /groups/:id/members/:id   // Remove member
```

**Database**: PostgreSQL

---

### 6. Notification Service (Port 3006)

**Purpose**: Push notifications

**Responsibilities**:
- Push notifications
- Email notifications
- SMS alerts

**Endpoints**:
```go
POST   /notifications/push   // Send push
POST   /notifications/email // Send email
POST   /notifications/sms   // Send SMS
```

**Providers**: FCM, APNs, SendGrid, Twilio

---

### 7. AI Service (Port 3007)

**Purpose**: AI features (Dandara)

**Responsibilities**:
- Chat assistant
- Translation
- Summarization

**Endpoints**:
```go
POST   /ai/chat           // Chat with AI
POST   /ai/translate     // Translate
POST   /ai/summarize      // Summarize chat
```

**AI**: OpenAI API, custom models

---

### 8. Theme Service (Port 3009)

**Purpose**: Theme management

**Responsibilities**:
- Theme storage
- Theme marketplace
- User theme preferences

**Endpoints**:
```go
GET    /themes                    // List themes
GET    /themes/:id               // Get theme
POST   /themes                  // Create theme
PUT    /users/me/theme          // Set user theme
```

**Database**: MongoDB

---

## Service Communication

### Synchronous (gRPC)

For direct service-to-service calls:

```go
// Server (chat-service)
rpc GetUserChats(GetUserChatsRequest) returns (stream Chat);

// Client (auth-service)
client := grpc.NewClient()
chats, err := client.GetUserChats(&GetUserChatsRequest{
    UserId: "user_123"
})
```

### Asynchronous (Events)

For event-driven communication:

```go
// Publish event
broker.Publish("message.new", MessageEvent{
    ChatId:    "chat_123",
    MessageId: "msg_456"
})

// Subscribe to event
broker.Subscribe("message.new", func(event MessageEvent) {
    // Handle new message
})
```

---

## Database Schema

### PostgreSQL (Relational Data)

```sql
-- Users
CREATE TABLE users (
    id UUID PRIMARY KEY,
    phone VARCHAR(20) UNIQUE,
    username VARCHAR(50) UNIQUE,
    display_name VARCHAR(100),
    created_at TIMESTAMP
);

-- Messages
CREATE TABLE messages (
    id UUID PRIMARY KEY,
    chat_id UUID REFERENCES chats(id),
    sender_id UUID REFERENCES users(id),
    content TEXT,
    content_type VARCHAR(20),
    created_at TIMESTAMP
);

-- Chats
CREATE TABLE chats (
    id UUID PRIMARY KEY,
    type VARCHAR(20),  -- 'direct', 'group', 'channel'
    created_at TIMESTAMP
);
```

### MongoDB (Documents)

```javascript
// User settings
{
    "_id": ObjectId,
    "user_id": "uuid",
    "theme": {
        "mode": "dark",
        "accent_color": "#007AFF"
    },
    "notifications": {
        "push": true,
        "email": false
    }
}
```

### Redis (Cache & Real-time)

```
# Session cache
SESSION:{user_id} = "jwt_token"

# Online status
USER:ONLINE:{user_id} = "true"

# Typing indicator
CHAT:TYPING:{chat_id}:{user_id} = timestamp

# WebSocket connections
WS:SERVER:{server_id} = [connection_ids]
```

---

## API Gateway

### Routes Configuration

```yaml
routes:
  - path: /api/auth/*
    service: auth-service
    auth: optional
    
  - path: /api/chats/*
    service: chat-service
    auth: required
    
  - path: /api/users/*
    service: user-service
    auth: required
    
  - path: /ws/*
    service: chat-service
    auth: required
    proxy: websocket
```

### Middleware

```go
// Rate limiting
rate_limit:
  requests: 100
  window: 60s
  
// CORS
cors:
  origins: ["*"]
  methods: ["GET", "POST", "PUT", "DELETE"]
  
// Compression
compression:
  enabled: true
  min_size: 1kb
```

---

## Deployment

### Docker Compose (Development)

```yaml
version: '3.8'

services:
  postgres:
    image: postgres:15-alpine
    ports: [5432:5432]
    
  mongodb:
    image: mongo:7
    ports: [27017:27017]
    
  redis:
    image: redis:7-alpine
    ports: [6379:6379]
    
  auth-service:
    build: ./server/auth
    ports: [3001:3001]
    
  chat-service:
    build: ./server/chat
    ports: [3002:3002]
```

### Kubernetes (Production)

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: chat-service
spec:
  replicas: 3
  template:
    spec:
      containers:
      - name: chat-service
        image: socialize/chat-service:v1.0.0
        ports: [3002]
```

---

## Monitoring

### Metrics

| Metric | Type | Description |
|--------|------|-------------|
| `requests_total` | Counter | Total requests |
| `request_duration` | Histogram | Request latency |
| `active_connections` | Gauge | WebSocket connections |
| `messages_sent` | Counter | Messages sent |

### Health Checks

```go
GET /health
Response: {
    "status": "healthy",
    "services": {
        "postgres": "up",
        "redis": "up"
    }
}
```
