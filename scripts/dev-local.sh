#!/usr/bin/env bash
# dev-local.sh — sobe tudo local, detecta IP LAN, configura mobile, gera APK
# Uso: ./scripts/dev-local.sh [--apk]

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SERVER_DIR="$ROOT_DIR/server"
MOBILE_DIR="$ROOT_DIR/mobile"

# Cores
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

log() { echo -e "${GREEN}[dev-local]${NC} $*"; }
warn() { echo -e "${YELLOW}[dev-local]${NC} $*"; }
err() { echo -e "${RED}[dev-local]${NC} $*" >&2; }

# 1. Verifica dependências
for cmd in docker bun go; do
  if ! command -v "$cmd" &>/dev/null; then
    err "Comando '$cmd' não encontrado. Instale: docker, bun, go"
    exit 1
  fi
done

# 2. Sobe Postgres + Redis (perfil local-pg)
log "Subindo Postgres + Redis (docker compose --profile local-pg)..."
cd "$SERVER_DIR"
docker compose --profile local-pg up -d

# 3. Aguarda healthchecks
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

# 4. Garante .env do server
if [[ ! -f .env ]]; then
  log "Criando .env do server a partir do .env.example..."
  cp .env.example .env
  # Ajusta DATABASE_URL para o Postgres local
  sed -i 's|DATABASE_URL=.*|DATABASE_URL=postgres://socialize:socialize@localhost:5432/socialize?sslmode=disable|' .env
  # Gera secrets se não existirem
  if ! grep -q '^JWT_SECRET=' .env || grep -q '^JWT_SECRET=$' .env; then
    sed -i "s/^JWT_SECRET=.*/JWT_SECRET=$(openssl rand -hex 32)/" .env
  fi
  if ! grep -q '^REFRESH_SECRET=' .env || grep -q '^REFRESH_SECRET=$' .env; then
    sed -i "s/^REFRESH_SECRET=.*/REFRESH_SECRET=$(openssl rand -hex 32)/" .env
  fi
  log ".env configurado para Postgres local"
fi

# 5. Roda migrations (usa POSTGRES_URL do .env)
log "Rodando migrations..."
POSTGRES_URL="postgres://socialize:socialize@localhost:5432/socialize?sslmode=disable" make migrate-up

# 6. Compila e roda API em background
log "Compilando API..."
make build

log "Iniciando API (porta 8080)..."
./bin/api &
API_PID=$!
trap "kill $API_PID 2>/dev/null; docker compose --profile local-pg down; exit" INT TERM EXIT

# Aguarda API subir
for i in {1..15}; do
  if curl -s http://localhost:8080/api/healthz >/dev/null 2>&1; then
    log "API respondendo em http://localhost:8080"
    break
  fi
  sleep 1
done

# 7. Detecta IP LAN
LAN_IP=$(ip route get 1.1.1.1 2>/dev/null | awk '{print $7; exit}')
if [[ -z "$LAN_IP" ]]; then
  LAN_IP=$(hostname -I | awk '{print $1}')
fi
log "IP LAN detectado: $LAN_IP"

# 8. Atualiza mobile/.env com IP LAN
MOBILE_ENV="$MOBILE_DIR/.env"
log "Configurando mobile/.env para $LAN_IP:8080..."
cat > "$MOBILE_ENV" <<EOF
# Gerado automaticamente por dev-local.sh em $(date)
EXPO_PUBLIC_API_URL=http://$LAN_IP:8080
EXPO_PUBLIC_WS_URL=ws://$LAN_IP:8080
EOF

# 9. Instala deps mobile se necessário
cd "$MOBILE_DIR"
if [[ ! -d node_modules ]]; then
  log "Instalando dependências mobile (bun install)..."
  bun install
fi

# 10. Gera APK se solicitado
if [[ "${1:-}" == "--apk" ]]; then
  log "Gerando APK (preview)..."
  if command -v eas &>/dev/null; then
    eas build --platform android --profile preview --non-interactive
  else
    warn "eas-cli não encontrado. Instale: npm i -g eas-cli"
    warn "Ou gere localmente: npx expo run:android --variant release"
  fi
else
  log "Mobile pronto. Para gerar APK depois:"
  log "  cd mobile && eas build --platform android --profile preview"
  log "  ou: npx expo run:android --variant release"
fi

# 11. Instruções finais
echo
echo "=========================================="
echo "  TUDO RODANDO LOCALMENTE"
echo "=========================================="
echo "API:        http://$LAN_IP:8080"
echo "Health:     http://$LAN_IP:8080/api/healthz"
echo "Postgres:   localhost:5432 (socialize/socialize)"
echo "Redis:      localhost:6379"
echo
echo "No celular Android:"
echo "  1. Conecte na mesma Wi-Fi"
echo "  2. Instale o APK gerado"
echo "  3. O app já aponta para http://$LAN_IP:8080"
echo
echo "Para parar tudo: Ctrl+C"
echo "=========================================="

# Mantém script vivo enquanto API roda
wait $API_PID