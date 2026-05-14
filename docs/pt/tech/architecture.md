# 🏗️ Arquitetura

## Microsserviços

```
API Gateway
├── Auth Service (3001)
├── Chat Service (3002)
├── User Service (3003)
├── Media Service (3004)
├── Group Service (3005)
├── Notification Service (3006)
├── AI Service (3007)
└── Theme Service (3009)
```

## Comunicação
- gRPC: sincrona entre serviços
- Eventos (Redis/Kafka): comunicação assíncrona
