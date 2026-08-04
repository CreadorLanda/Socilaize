#!/usr/bin/env bash
# vps-backend.sh — sobe TODO o backend na VPS (Postgres + Redis + API no Docker)
# Uso na VPS: ./scripts/vps-backend.sh
#
# Depois:
#   - IP = <ip_da_vps>:8080  (ou domínio via Caddy)
#   - Teste local em dev mode apontando para esse IP
#   - Gere o APK com o mesmo IP

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SERVER_DIR="$ROOT_DIR/server"

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

log() { echo -e "${GREEN}[vps]${NC} $*"; }
warn() { echo -e "${YELLOW}[vps]${NC} $*"; }
err() { echo -e "${RED}[vps]${NC} $*" >&2; }

cd "$SERVER_DIR"

# 1. Verifica docker + migrate
for cmd in docker migrate; do
  if ! command -v "$cmd" &>/dev/null; then
    err "'$cmd' não encontrado. Instale docker e golang-migrate."
    err "golang-migrate: go install -tags 'postgres' github.com/golang-migrate/migrate/v4/cmd/migrate@latest"
    exit 1
  fi
done

# 2. Sobe Postgres + Redis (perfil local-pg = tudo rodando na VPS)
log "Subindo Postgres + Redis..."
docker compose --profile local-pg up -d

log "Aguardando serviços ficarem saudáveis..."
for svc in postgres redis; do
  for i in {1..30}; do
    if docker compose ps "$svc" | grep -q "healthy"; then
      log "$svc OK"
      break
    fi
    sleep 1
  done
done

# 3. Configura .env (Postgres local + secrets gerados)
if [[ ! -f .env ]]; then
  log "Criando .env para Postgres local..."
  cp .env.example .env
  sed -i 's|DATABASE_URL=.*|DATABASE_URL=postgres://socialize:socialize@localhost:5432/socialize?sslmode=disable|' .env
  sed -i "s/^JWT_SECRET=.*/JWT_SECRET=$(openssl rand -hex 32)/" .env
  sed -i "s/^REFRESH_SECRET=.*/REFRESH_SECRET=$(openssl rand -hex 32)/" .env
fi

# 4. Migrations
log "Rodando migrations..."
POSTGRES_URL="postgres://socialize:socialize@localhost:5432/socialize?sslmode=disable" make migrate-up

# 5. Build + roda API
log "Compilando API..."
make build

log "Iniciando API na porta 8080..."
./bin/api &
API_PID=$!
trap "kill $API_PID 2>/dev/null" INT TERM EXIT

for i in {1..15}; do
  if curl -s http://localhost:8080/api/healthz >/dev/null 2>&1; then
    log "API saudável!"
    break
  fi
  sleep 1
done

# 6. Descobre IP público
PUBLIC_IP=$(curl -s --max-time 5 ifconfig.me || curl -s --max-time 5 icanhazip.com || hostname -I | awk '{print $1}')
LOCAL_IP=$(hostname -I | awk '{print $1}')

echo
echo "=============================================="
echo "  BACKEND RODANDO NA VPS"
echo "=============================================="
echo "Público:  http://$PUBLIC_IP:8080"
echo "Local:    http://$LOCAL_IP:8080"
echo "Health:   http://$PUBLIC_IP:8080/api/healthz"
echo
echo "No seu PC (dev mode), configure mobile/.env:"
echo "  EXPO_PUBLIC_API_URL=http://$PUBLIC_IP:8080"
echo "  EXPO_PUBLIC_WS_URL=ws://$PUBLIC_IP:8080"
echo
echo "Firewall (se precisar): sudo ufw allow 8080/tcp"
echo "=============================================="

wait $API_PID