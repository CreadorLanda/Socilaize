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

# 1. Instala o que faltar (Go, golang-migrate, bun) — docker deve estar instalado
if ! command -v docker &>/dev/null; then
  err "Docker não encontrado. Instale: https://docs.docker.com/engine/install/"
  exit 1
fi

# Go: precisa de 1.24+ (golang-migrate atual exige). Instala do tarball oficial
# se a versão do sistema for antiga.
GO_VERSION="1.24.5"
GO_ARCH="amd64"
case "$(uname -m)" in
  aarch64|arm64) GO_ARCH="arm64" ;;
esac
go_ok() {
  if ! command -v go &>/dev/null; then return 1; fi
  local v
  v="$(go version | sed -E 's/.*go([0-9]+)\.([0-9]+).*/\1.\2/')"
  [[ "$(printf '%s\n%s\n' "$v" "$GO_VERSION" | sort -V | head -1)" == "$GO_VERSION" ]]
}
if ! go_ok; then
  warn "Go < 1.24 ou ausente. Instalando Go $GO_VERSION (linux-$GO_ARCH)..."
  curl -fsSL "https://go.dev/dl/go${GO_VERSION}.linux-${GO_ARCH}.tar.gz" -o /tmp/go.tar.gz
  sudo rm -rf /usr/local/go
  sudo tar -C /usr/local -xzf /tmp/go.tar.gz
  rm -f /tmp/go.tar.gz
fi
export PATH="/usr/local/go/bin:$HOME/go/bin:$PATH"

if ! command -v migrate &>/dev/null; then
  log "Instalando golang-migrate..."
  go install -tags 'postgres' github.com/golang-migrate/migrate/v4/cmd/migrate@latest
fi
export PATH="$HOME/go/bin:$PATH"

if ! command -v bun &>/dev/null; then
  warn "Bun não encontrado. Instalando..."
  curl -fsSL https://bun.sh/install | bash
  export PATH="$HOME/.bun/bin:$PATH"
fi

# 2. Sobe Postgres + Redis (perfil local-pg)
log "Subindo Postgres + Redis (docker compose --profile local-pg)..."
cd "$SERVER_DIR"
docker compose -f deploy/docker/docker-compose.yml --profile local-pg up -d

# 3. Aguarda healthchecks
log "Aguardando serviços ficarem saudáveis..."
for svc in postgres redis; do
  for i in {1..30}; do
    if docker compose -f deploy/docker/docker-compose.yml ps "$svc" | grep -q "healthy"; then
      log "$svc OK"
      break
    fi
    sleep 1
  done
done

# 4. Garante .env do server (sempre sobrescreve URLs/placeholders)
log "Configurando .env do server para Postgres local..."
if [[ ! -f .env ]]; then
  cp .env.example .env
fi
sed -i "s|^POSTGRES_URL=.*|POSTGRES_URL=postgres://socialize:socialize@localhost:5432/socialize?sslmode=disable|" .env
sed -i "s|^REDIS_URL=.*|REDIS_URL=redis://localhost:6379/0|" .env
sed -i "s|^JWT_SECRET=.*|JWT_SECRET=$(openssl rand -hex 32)|" .env
sed -i "s|^MESSAGE_KEY=.*|MESSAGE_KEY=$(openssl rand -hex 32)|" .env
log ".env configurado para Postgres local"

# 5. Roda migrations (usa POSTGRES_URL do .env)
log "Rodando migrations..."
POSTGRES_URL="postgres://socialize:socialize@localhost:5432/socialize?sslmode=disable" make migrate-up

# 6. Compila e roda API em background
log "Compilando API..."
make build

log "Iniciando API (porta 8080)..."
./bin/api &
API_PID=$!
trap "kill $API_PID 2>/dev/null; docker compose -f deploy/docker/docker-compose.yml --profile local-pg down; exit" INT TERM EXIT

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

# 11. Instrucoes finais
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