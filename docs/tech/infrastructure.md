# 🏗️ Infraestrutura

> Documentação de infraestrutura do Socialize.

---

## Visão Geral

O Socialize utiliza Docker, Kubernetes e CI/CD para deployment eficiente e escalável.

---

## 🐳 Docker

### Dockerfile - Backend

```dockerfile
# server/Dockerfile
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

### Dockerfile - Mobile Build

```dockerfile
# apps/mobile/Dockerfile
FROM node:18-alpine

WORKDIR /app
COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run prebuild

CMD ["npm", "run", "ios"]
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
    volumes:
      - pg_data:/var/lib/postgresql/data
    ports:
      - "5432:5432"

  mongodb:
    image: mongo:7
    environment:
      MONGO_INITDB_ROOT_USERNAME: socialize
      MONGO_INITDB_ROOT_PASSWORD: socialize
    volumes:
      - mongo_data:/data/db
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
    depends_on:
      - postgres
      - mongodb
      - redis

volumes:
  pg_data:
  mongo_data:
```

---

## ☸️ Kubernetes

### Deployment

```yaml
# k8s/deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: socialize-api
spec:
  replicas: 3
  selector:
    matchLabels:
      app: socialize-api
  template:
    metadata:
      labels:
        app: socialize-api
    spec:
      containers:
      - name: api
        image: socialize/api:latest
        ports:
        - containerPort: 3000
        resources:
          limits:
            cpu: "500m"
            memory: "512Mi"
```

### Service

```yaml
# k8s/service.yaml
apiVersion: v1
kind: Service
metadata:
  name: socialize-api
spec:
  selector:
    app: socialize-api
  ports:
  - port: 80
    targetPort: 3000
  type: ClusterIP
```

### Ingress

```yaml
# k8s/ingress.yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: socialize-ingress
  annotations:
    nginx.ingress.kubernetes.io/ssl-redirect: "true"
spec:
  rules:
  - host: api.socialize.app
    http:
      paths:
      - path: /
        pathType: Prefix
        backend:
          service:
            name: socialize-api
            port:
              number: 80
```

---

## 🔄 CI/CD

### GitHub Actions

```yaml
# .github/workflows/ci.yml
name: CI

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: Set up Go
        uses: actions/setup-go@v5
        with:
          go-version: '1.21'
      
      - name: Test
        run: go test -v ./...
      
      - name: Build
        run: go build -o server ./server

  docker:
    needs: test
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: Build image
        run: docker build -t socialize/server:${{ github.sha }} .
      
      - name: Push image
        run: |
          echo ${{ secrets.DOCKER_TOKEN }} | docker login -u ${{ secrets.DOCKER_USER }} --password-stdin
          docker push socialize/server:${{ github.sha }}
```

### Deploy Pipeline

```yaml
# .github/workflows/deploy.yml
name: Deploy

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: Deploy to K8s
        run: |
          kubectl set image deployment/api api=socialize/server:${{ github.sha }}
```

---

## 📊 Monitoramento

### Prometheus + Grafana

```yaml
# monitoring/prometheus.yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: prometheus-config
data:
  prometheus.yml: |
    scrape_configs:
    - job_name: 'socialize'
      metrics_path: /metrics
```

### Logs

```yaml
# monitoring/loki.yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: loki-config
data:
  loki.yml: |
    auth_enabled: false
    server:
      http_listen_port: 3100
```

---

## 🔒 Secrets

```bash
# Usar Kubernetes Secrets
kubectl create secret generic socialize-secrets \
  --from-literal=DB_PASSWORD=senha \
  --from-literal=JWT_SECRET=chave
```

---

## 📈 Referências

- [Arquitetura](./architecture.md)