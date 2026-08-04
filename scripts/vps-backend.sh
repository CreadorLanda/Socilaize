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

# 1. Verifica sudo
if ! sudo -v &>/dev/null; then
  err "Precisa de sudo para instalar dependências."
  exit 1
fi

# 1b. Instala make (usado para build e migrations)
if ! command -v make &>/dev/null; then
  log "Instalando make..."
  sudo apt-get update -qq
  sudo apt-get install -y -qq make
fi

# 2. Instala o que faltar (Go, Docker, Docker Compose, golang-migrate)
need_sudo_install=false

# Go: precisa de 1.24+ (golang-migrate atual exige). Instala do tarball oficial,
# não do apt (o apt do Ubuntu traz 1.22, que quebra o migrate).
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
  log "Instalando Go $GO_VERSION (linux-$GO_ARCH, tarball oficial)..."
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

if ! command -v docker &>/dev/null; then
  log "Instalando Docker..."
  curl -fsSL https://get.docker.com | sudo sh
  sudo usermod -aG docker "$USER"
  newgrp docker
  need_sudo_install=true
fi

if ! docker compose version &>/dev/null; then
  log "Instalando Docker Compose (binário direto do GitHub)..."
  COMPOSE_VERSION="v2.29.7"
  COMPOSE_ARCH="x86_64"
  case "$(uname -m)" in
    aarch64|arm64) COMPOSE_ARCH="aarch64" ;;
  esac
  sudo mkdir -p /usr/local/lib/docker/cli-plugins
  sudo curl -fsSL "https://github.com/docker/compose/releases/download/${COMPOSE_VERSION}/docker-compose-linux-${COMPOSE_ARCH}" -o /usr/local/lib/docker/cli-plugins/docker-compose
  sudo chmod +x /usr/local/lib/docker/cli-plugins/docker-compose
fi

if [[ "$need_sudo_install" == "true" ]]; then
  warn "Docker instalado. Re-execute o script numa nova sessão (o grupo docker foi atualizado)."
  exit 0
fi

# Garante que docker funciona sem sudo
if ! docker info &>/dev/null; then
  sudo chmod 666 /var/run/docker.sock 2>/dev/null || true
fi

# Garante que o repo é gravável pelo usuário atual (clone via root deixa root)
if [[ ! -w "$SERVER_DIR" ]]; then
  warn "Diretório sem permissão de escrita. Corrigindo dono para $USER..."
  sudo chown -R "$USER":"$USER" "$ROOT_DIR"
fi

# 3. Sobe Postgres + Redis (perfil local-pg = tudo rodando na VPS)
COMPOSE_FILE="deploy/docker/docker-compose.yml"
log "Subindo Postgres + Redis..."
docker compose -f "$COMPOSE_FILE" --profile local-pg up -d

log "Aguardando serviços ficarem saudáveis..."
for svc in postgres redis; do
  for i in {1..30}; do
    if docker compose -f "$COMPOSE_FILE" ps "$svc" | grep -q "healthy"; then
      log "$svc OK"
      break
    fi
    sleep 1
  done
done

# 4. Configura .env (Postgres local + secrets gerados)
# Sobrescreve SEMPRE as URLs/placeholders — o .env.example traz valores do
# Supabase/Upstash que quebram o parse. O .env local da VPS é o que vale.
log "Configurando .env para Postgres local..."
if [[ ! -f .env ]]; then
  cp .env.example .env
fi
sed -i "s|^POSTGRES_URL=.*|POSTGRES_URL=postgres://socialize:socialize@localhost:5432/socialize?sslmode=disable|" .env
sed -i "s|^REDIS_URL=.*|REDIS_URL=redis://localhost:6379/0|" .env
sed -i "s|^JWT_SECRET=.*|JWT_SECRET=$(openssl rand -hex 32)|" .env
sed -i "s|^MESSAGE_KEY=.*|MESSAGE_KEY=$(openssl rand -hex 32)|" .env

# 5. Migrations
log "Rodando migrations..."
POSTGRES_URL="postgres://socialize:socialize@localhost:5432/socialize?sslmode=disable" make migrate-up

# 6. Build + roda API
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

# 7. Descobre IP público
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