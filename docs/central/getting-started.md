# 🚀 Getting Started

> Guia completo para começar com o Socialize.

## Pré-requisitos

| Requisito | Versão Mínima | Notas |
|-----------|--------------|-------|
| **Node.js** | 18.x ou superior | LTC |
| **Go** | 1.21 ou superior | Backend |
| **Docker** | Latest | containers |
| **Git** | 2.x | Versionamento |

### Para Desenvolvimento Mobile

| Requisito | Plataforma | Notas |
|-----------|------------|-------|
| **Xcode** | macOS apenas | Para iOS |
| **Android Studio** | Todos | Para Android |
| **Watchman** | Todos | File watcher |

---

## ⚡ Instalação Rápida

### 1. Clone o Repositório

```bash
git clone https://github.com/socialize/socialize.git
cd socialize
```

### 2. Instale Dependências

```bash
# Instala todas as dependências
npm install

# ou com yarn
yarn install
```

### 3. Configure o Ambiente

```bash
# Copie o arquivo de exemplo de variáveis de ambiente
cp .env.example .env
```

### 4. Execute o Desenvolvimento

```bash
# Inicia o servidor backend
npm run dev:server

# Em outro terminal, inicia o app mobile
npm run dev:mobile

# ou inicia o app web
npm run dev:web
```

---

## 🔧 Configuração Detalhada

### Variáveis de Ambiente

Edite o arquivo `.env` com suas configurações:

```env
# Server
PORT=3000
NODE_ENV=development

# Database
DATABASE_URL=postgresql://user:pass@localhost:5432/socialize
MONGODB_URI=mongodb://localhost:27017/socialize
REDIS_URL=redis://localhost:6379

# JWT
JWT_SECRET=sua_chave_secreta_aqui
JWT_EXPIRES_IN=7d

# WhatsApp Integration
EVOLUTION_API_URL=http://localhost:9080
EVOLUTION_API_KEY=sua_api_key

# Dandara AI
DANDARA_API_KEY=sua_chave_dandara

# Cloud (optional)
CLOUD_PROVIDER=aws  # aws, gcp, azure
```

### Configuração do Banco de Dados

#### PostgreSQL

```bash
# Usando Docker
docker run -d \
  --name socialize-pg \
  -e POSTGRES_DB=socialize \
  -e POSTGRES_USER=socialize \
  -e POSTGRES_PASSWORD=socialize \
  -p 5432:5432 \
  postgres:15-alpine
```

#### MongoDB

```bash
# Usando Docker
docker run -d \
  --name socialize-mongo \
  -e MONGO_INITDB_ROOT_USERNAME=socialize \
  -e MONGO_INITDB_ROOT_PASSWORD=socialize \
  -p 27017:27017 \
  mongo:7
```

#### Redis

```bash
# Usando Docker
docker run -d \
  --name socialize-redis \
  -p 6379:6379 \
  redis:7-alpine
```

### Configuração do WhatsApp (Opcional)

Para integração com WhatsApp via Evolution API:

```bash
docker run -d \
  --name evolve-api \
  -e SERVER_URL=http://localhost:9080 \
  -e DATABASE_CONNECTION_URI=mongodb://localhost:27017/socialize \
  -e DATABASE_PASSWORD=socialize \
  -e AUTH_SECRET=your_auth_secret \
  -p 9080:9080
```

---

## 📱 Executando os Apps

### Mobile (React Native)

```bash
# Instale as dependências do app mobile
cd apps/mobile
npm install

# Execute no Android (emulador)
npm run android

# Execute no iOS (macOS)
npm run ios

# Execute no web
npm run web
```

### Backend (Go Microservices)

```bash
# Entre no diretório do servidor
cd server

# Execute todos os microserviços
make run-all

# ou execute um serviço específico
make run auth-service
make run message-service
make run user-service
```

### Usando Docker Compose

```bash
# Inicia todos os serviços
docker-compose up -d

# Ver os logs
docker-compose logs -f

# Parar todos os serviços
docker-compose down
```

---

## 🧪 Executando Testes

```bash
# Testes unitários
npm run test

# Testes de integração
npm run test:integration

# Coverage
npm run test:coverage

# E2E (requer ambiente configurado)
npm run test:e2e
```

---

## 🔐 Configuração de Segurança

### Gerando Chaves SSH (para Git)

```bash
# Gerar chave SSH
ssh-keygen -t ed25519 -C "seu_email@exemplo.com"

# Adicionar ao ssh-agent
eval "$(ssh-agent -s)"
ssh-add ~/.ssh/id_ed25519
```

### Configuração de GPG para Commits

```bash
# Gerar chave GPG
gpg --full-generate-key

# Listar chaves
gpg --list-secret-keys --keyid-format=long

# Configurar Git para usar a chave
git config --global user.signingkey SUA_CHAVE_AQUI
git config --global commit.gpgsign true
```

---

## 🆘 Troubleshooting

### Problemas Comuns

#### Erro: "port is already in use"

```bash
# Encontre o processo usando a porta
lsof -i :3000

# Mate o processo
kill -9 PID
```

#### Erro: "module not found"

```bash
# Limpe o cache e reinstale
rm -rf node_modules package-lock.json
npm install
```

#### Erro de permissão no macOS

```bash
# Se tiver erro de permissão
sudo chown -R $(whoami) ~/.npm
```

#### Problemas com Docker

```bash
# Limpe containers e imagens antigos
docker system prune -a
```

---

## 📚 Próximos Passos

Após configurar o ambiente:

1. Leia a [Arquitetura](./docs/tech/architecture.md)
2. Entenda a [Stack Técnica](./docs/tech/backend-go.md)
3. Configure [Segurança](./docs/security/encryption.md)
4. Contribua! Leia o [Guia de Contribuição](./CONTRIBUTING.md)

---

## 💬 Suporte

| Canal | Link |
|-------|------|
| Discord | [discord.gg/socialize](https://discord.gg/socialize) |
| Issues | [github.com/socialize/socialize/issues](https://github.com/socialize/socialize/issues) |
| Email | suporte@socialize.app |

---

> **Dica:** Para desenvolvimento mais rápido, use a flag `--fast` ao executar serviços.