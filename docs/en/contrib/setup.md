# ⚙️ Setup

> Development environment setup guide.

---

## Prerequisites

### Required

| Tool | Version | Installation |
|-----------|-------|------------|
| **Node.js** | 18+ | [nodejs.org](https://nodejs.org) |
| **Go** | 1.21+ | [go.dev](https://go.dev) |
| **Git** | 2.x | [git-scm.com](https://git-scm.com) |
| **Docker** | Latest | [docker.com](https://docker.com) |

---

## Quick Setup

### 1. Clone the Repository

```bash
git clone https://github.com/socialize/socialize.git
cd socialize
```

### 2. Install Dependencies

```bash
# Backend Go
cd server && go mod download

# Frontend
npm install

# Mobile
cd apps/mobile && npm install
```

### 3. Configure Environment

```bash
cp .env.example .env
# Edit .env file
```

### 4. Start Services

```bash
# Docker (DB + Redis)
docker-compose up -d

# Backend
make run

# Frontend (in another terminal)
npm run dev
```

---

## Backend (Go)

### Environment Variables

```env
DATABASE_URL=postgresql://socialize:socialize@localhost:5432/socialize
MONGODB_URI=mongodb://socialize:socialize@localhost:27017/socialize
REDIS_URL=redis://localhost:6379
JWT_SECRET=your_secret_key_here
```

### Run

```bash
cd server
make run
```

---

## Mobile (React Native)

### Setup

```bash
cd apps/mobile
npm install

# Expo
npx expo start

# or emulator
npx expo run:android
```

---

## 💬 Support

| Channel | Link |
|---------|------|
| Discord | discord.gg/socialize |
| Issues | github.com/socialize/socialize/issues |