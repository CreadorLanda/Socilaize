# 🏗️ Microservices Architecture

> Documentation for Socialize microservices architecture.

---

## Architecture Overview

Socialize is built using a Go microservices architecture designed for scalability, availability, and maintainability.

---

## Architectural Principles

| Principle | Description |
|----------|-------------|
| **Single Responsibility** | Each service does one thing well |
| **Loose Coupling** | Services communicate via APIs |
| **High Cohesion** | Related functionality in same service |
| **Scalability** | Horizontal scaling |
| **Resilience** | Fault tolerance |

---

## Microservices

```
┌─────────────────────────────────────────────────────────────┐
│                     API Gateway                              │
│                   (nginx / Traefik)                        │
└─────────────────────────────────────────────────────────────┘
        │
        ▼
┌──────────────┐    ┌──────────────┐    ┌──────────────┐
│ Auth Service │    │ Chat Svc    │    │ User Service │
│   (Port 3001)│    │ (Port 3002) │    │  (Port 3003)│
└──────────────┘    └──────────────┘    └──────────────┘
        │                   │                   ▼
        ▼                   ▼           ┌──────────────┐
┌──────────────┐    ┌──────────────┐    │ Notif Svc   │
│ Media Svc    │    │ Group Svc    │    │  (Port 3006)│
│ (Port 3004)  │    │ (Port 3005)  │    └──────────────┘
└──────────────┘    └──────────────┘
        │                   ▼
        ▼           ┌──────────────┐
┌──────────────┐    │ Theme Svc   │
│   AI Service │    │  (Port 3009)│
│ (Port 3007) │    └──────────────┘
└──────────────┘
```

### Services Description

| Service | Function | Dependencies |
|---------|----------|-------------|
| **Auth Service** | Authentication, JWT, OAuth | PostgreSQL, Redis |
| **Chat Service** | Messages, WebSocket | PostgreSQL, Redis |
| **User Service** | Profiles, contacts | PostgreSQL, MongoDB |
| **Media Service** | Upload, processing | S3, FFmpeg |
| **Group Service** | Groups, channels | PostgreSQL |
| **Notification Service** | Push, email | Redis, FCM, APNs |
| **AI Service** | Dandara AI | OpenAI API |
| **Theme Service** | Themes, customization | MongoDB |

---

## Service Communication

### gRPC

Used for synchronous communication between services.

### Events (Async)

For asynchronous communication, use a message broker:

```
Service A ──▶ Message Broker ──▶ Service B
                      │
                 ┌────────┐
                 │ Redis  │
                 │ Kafka  │
                 │ NATS   │
                 └──────┘
```

---

## References

- [Database Schema](./database.md)
- [API Reference](./api.md)
- [Backend Go](./backend-go.md)
- [Infrastructure](./infrastructure.md)