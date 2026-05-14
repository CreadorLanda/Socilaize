# 🏗️ Infrastructure

> Documentation for Socialize infrastructure.

---

## Overview

Socialize uses Docker, Kubernetes, and CI/CD for efficient and scalable deployment.

---

## Docker

### Dockerfile - Backend

```dockerfile
FROM golang:1.21-alpine AS builder
WORKDIR /app
COPY go.mod go.sum ./
RUN go mod download
COPY . .
RUN CGO_ENABLED=0 GOOS=linux go build -o /server ./cmd/server

FROM alpine:3.18
RUN apk --no-cache add ca-certificates
COPY --from=builder /server /server
EXPOSE 3000
CMD ["/server"]
```

### docker-compose.yml

```yaml
version: '3.8'

services:
  postgres:
    image: postgres:15-alpine
    environment:
      POSTGRES_DB: socialize
      POSTGRES_USER: socialize
      POSTGRES_PASSWORD: socialize
    ports:
      - "5432:5432"

  mongodb:
    image: mongo:7
    ports:
      - "27017:27017"

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"

  api:
    build: ./server
    ports:
      - "3000:3000"
```

---

## CI/CD

### GitHub Actions

```yaml
name: CI

on:
  push:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Set up Go
        uses: actions/setup-go@v5
      - name: Test
        run: go test -v ./...
```

---

## References

- [Architecture](./architecture.md)