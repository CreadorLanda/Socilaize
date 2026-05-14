# 🚀 Getting Started

> Complete guide to get started with Socialize.

## Prerequisites

| Requirement | Minimum Version | Notes |
|-------------|-----------------|-------|
| **Node.js** | 18.x or higher | LTS |
| **Go** | 1.21 or higher | Backend |
| **Docker** | Latest | Containers |
| **Git** | 2.x | Versioning |

### For Mobile Development

| Requirement | Platform | Notes |
|-------------|----------|-------|
| **Xcode** | macOS only | For iOS |
| **Android Studio** | All | For Android |
| **Watchman** | All | File watcher |

---

## ⚡ Quick Installation

### 1. Clone the Repository

```bash
git clone https://github.com/socialize/socialize.git
cd socialize
```

### 2. Install Dependencies

```bash
# Install all dependencies
npm install

# or with yarn
yarn install
```

### 3. Configure Environment

```bash
# Copy the example environment variables file
cp .env.example .env
```

### 4. Run Development

```bash
# Start the backend server
npm run dev:server

# In another terminal, start the mobile app
npm run dev:mobile

# or start the web app
npm run dev:web
```

---

## 🔧 Detailed Configuration

### Environment Variables

Edit the `.env` file with your settings:

```env
# Server
PORT=3000
NODE_ENV=development

# Database
DATABASE_URL=postgresql://user:pass@localhost:5432/socialize
MONGODB_URI=mongodb://localhost:27017/socialize
REDIS_URL=redis://localhost:6379

# JWT
JWT_SECRET=your_secret_key_here
JWT_EXPIRES_IN=7d

# WhatsApp Integration
EVOLUTION_API_URL=http://localhost:9080
EVOLUTION_API_KEY=your_api_key

# Dandara AI
DANDARA_API_KEY=your_dandara_key

# Cloud (optional)
CLOUD_PROVIDER=aws  # aws, gcp, azure
```

### Database Configuration

#### PostgreSQL

```bash
# Using Docker
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
# Using Docker
docker run -d \
  --name socialize-mongo \
  -e MONGO_INITDB_ROOT_USERNAME=socialize \
  -e MONGO_INITDB_ROOT_PASSWORD=socialize \
  -p 27017:27017 \
  mongo:7
```

#### Redis

```bash
# Using Docker
docker run -d \
  --name socialize-redis \
  -p 6379:6379 \
  redis:7-alpine
```

### WhatsApp Configuration (Optional)

For WhatsApp integration via Evolution API:

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

## 📱 Running the Apps

### Mobile (React Native)

```bash
# Install mobile app dependencies
cd apps/mobile
npm install

# Run on Android (emulator)
npm run android

# Run on iOS (macOS)
npm run ios

# Run on web
npm run web
```

### Backend (Go Microservices)

```bash
# Enter the server directory
cd server

# Run all microservices
make run-all

# or run a specific service
make run auth-service
make run message-service
make run user-service
```

### Using Docker Compose

```bash
# Start all services
docker-compose up -d

# View logs
docker-compose logs -f

# Stop all services
docker-compose down
```

---

## 🧪 Running Tests

```bash
# Unit tests
npm run test

# Integration tests
npm run test:integration

# Coverage
npm run test:coverage

# E2E (requires configured environment)
npm run test:e2e
```

---

## 🔐 Security Configuration

### Generating SSH Keys (for Git)

```bash
# Generate SSH key
ssh-keygen -t ed25519 -C "your_email@example.com"

# Add to ssh-agent
eval "$(ssh-agent -s)"
ssh-add ~/.ssh/id_ed25519
```

### GPG Configuration for Commits

```bash
# Generate GPG key
gpg --full-generate-key

# List keys
gpg --list-secret-keys --keyid-format=long

# Configure Git to use the key
git config --global user.signingkey YOUR_KEY_HERE
git config --global commit.gpgsign true
```

---

## 🆘 Troubleshooting

### Common Issues

#### Error: "port is already in use"

```bash
# Find the process using the port
lsof -i :3000

# Kill the process
kill -9 PID
```

#### Error: "module not found"

```bash
# Clear cache and reinstall
rm -rf node_modules package-lock.json
npm install
```

#### Permission error on macOS

```bash
# If you have a permission error
sudo chown -R $(whoami) ~/.npm
```

#### Docker Issues

```bash
# Clean old containers and images
docker system prune -a
```

---

## 📚 Next Steps

After setting up the environment:

1. Read the [Architecture](./docs/en/tech/architecture.md)
2. Understand the [Technical Stack](./docs/en/tech/backend-go.md)
3. Configure [Security](./docs/en/security/encryption.md)
4. Contribute! Read the [Contribution Guide](./CONTRIBUTING.md)

---

## 💬 Support

| Channel | Link |
|---------|------|
| Discord | [discord.gg/socialize](https://discord.gg/socialize) |
| Issues | [github.com/socialize/socialize/issues](https://github.com/socialize/socialize/issues) |
| Email | support@socialize.app |

---

> **Tip:** For faster development, use the `--fast` flag when running services.