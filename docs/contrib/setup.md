# ⚙️ Setup

> Guia de configuração do ambiente de desenvolvimento.

---

## 📋 Pré-requisitos

### Obrigatórios

| Ferramenta | Versão | Instalação |
|-----------|-------|------------|
| **Node.js** | 18+ | [nodejs.org](https://nodejs.org) |
| **Go** | 1.21+ | [go.dev](https://go.dev) |
| **Git** | 2.x | [git-scm.com](https://git-scm.com) |
| **Docker** | Latest | [docker.com](https://docker.com) |

### Opcionais (Mobile)

| Ferramenta | Plataforma | Notas |
|-----------|------------|-------|
| **Xcode** | macOS | iOS builds |
| **Android Studio** | Todos | Android builds |
| **Watchman** | Todos | File watcher |

---

## 🚀 Configuração Rápida

### 1. Clone o Repositório

```bash
git clone https://github.com/socialize/socialize.git
cd socialize
```

### 2. Instale Dependências

```bash
# Backend Go
cd server && go mod download

# Frontend
npm install

# Mobile
cd apps/mobile && npm install
```

### 3. Configure Variáveis

```bash
cp .env.example .env
# Edite o arquivo .env
```

### 4. Inicie Serviços

```bash
# Docker (DB + Redis)
docker-compose up -d

# Backend
make run

# Frontend (em outro terminal)
npm run dev
```

---

## 🐳 Docker

### Serviços Necessários

```bash
# Iniciar todos os serviços
docker-compose up -d

# Verificar status
docker-compose ps

# Logs
docker-compose logs -f
```

---

## 🔧 Backend (Go)

### Variáveis de Ambiente

```env
# .env
DATABASE_URL=postgresql://socialize:socialize@localhost:5432/socialize
MONGODB_URI=mongodb://socialize:socialize@localhost:27017/socialize
REDIS_URL=redis://localhost:6379
JWT_SECRET=sua_chave_secreta_aqui
```

### Executar

```bash
cd server

# Desenvolvimento
make run

# Testes
make test

# Build
make build
```

---

## 📱 Mobile (React Native)

### Configuração

```bash
cd apps/mobile

# dependencies
npm install

# Expo
npx expo start

# ou/emulator
npx expo run:android
```

### Android Emulator

1. Android Studio → AVD Manager
2. Crie/inicie emulator
3. Execute `npx expo run:android`

### iOS (macOS)

1. Execute `npx expo run:ios`
2. Selecione simulador

---

## 🧪 Troubleshooting

### Erro: "port already in use"

```bash
# Encontre o processo
lsof -i :3000

# Mate o processo
kill -9 PID
```

### Erro: "module not found"

```bash
rm -rf node_modules package-lock.json
npm install
```

### Problemas de Docker

```bash
# Limpe tudo
docker system prune -a
```

---

## 📚 Próximos Passos

1. Leia a [Arquitetura](./docs/tech/architecture.md)
2. Configure [Segurança](./docs/security/encryption.md)
3. Leia o [Style Guide](./docs/contrib/style-guide.md)

---

## 💬 Suporte

| Canal | Link |
|-------|------|
| Discord | discord.gg/socialize |
| Issues | github.com/socialize/socialize/issues |