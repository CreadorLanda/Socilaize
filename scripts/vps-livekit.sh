#!/usr/bin/env bash
#
# Põe o SFU (LiveKit) de pé na VPS e escreve as chaves no .env do backend.
#
# O LiveKit é open source (Apache 2.0) e corre inteiramente aqui — nenhum
# terceiro vê áudio nem vídeo. Na verdade este servidor também não: os
# clientes cifram os fluxos com uma chave derivada da sessão E2EE da conversa,
# que nunca sai dos telemóveis.
#
# Uso:  LIVEKIT_NODE_IP=<ip-publico> ./scripts/vps-livekit.sh
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
COMPOSE="$ROOT/server/deploy/docker/docker-compose.yml"
ENV_FILE="$ROOT/server/.env"

log() { printf '\n\033[1;36m==>\033[0m %s\n' "$*"; }
die() { printf '\n\033[1;31mERRO:\033[0m %s\n\n' "$*" >&2; exit 1; }

# ── 1. O endereço público ────────────────────────────────────────────────────
#
# É o que o SFU anuncia aos telemóveis como destino do média. Se estiver
# errado, a chamada liga e fica muda — pior do que falhar, porque parece que a
# outra pessoa é que não está a falar.
IP="${LIVEKIT_NODE_IP:-}"
if [[ -z "$IP" ]]; then
  IP=$(curl -s --max-time 5 ifconfig.me || curl -s --max-time 5 icanhazip.com || true)
  [[ -n "$IP" ]] && log "IP público detetado: $IP"
fi
[[ -z "$IP" ]] && die "não consegui descobrir o IP público. Corre com LIVEKIT_NODE_IP=<ip>"
[[ "$IP" =~ ^127\.|^10\.|^192\.168\.|^172\.(1[6-9]|2[0-9]|3[01])\. ]] && \
  die "LIVEKIT_NODE_IP=$IP é um endereço privado. Os telemóveis não lhe chegam."

# ── 2. Chaves ────────────────────────────────────────────────────────────────
#
# Geradas uma vez e reutilizadas: trocá-las invalida os tokens que o backend
# já assinou, e uma chamada a meio cai.
if grep -q '^LIVEKIT_API_KEY=' "$ENV_FILE" 2>/dev/null; then
  log "Chaves já existem em server/.env — reaproveitadas."
  API_KEY=$(grep -m1 '^LIVEKIT_API_KEY=' "$ENV_FILE" | cut -d= -f2-)
  API_SECRET=$(grep -m1 '^LIVEKIT_API_SECRET=' "$ENV_FILE" | cut -d= -f2-)
else
  log "A gerar chaves..."
  API_KEY="APP$(head -c 6 /dev/urandom | od -An -tx1 | tr -d ' \n')"
  API_SECRET=$(head -c 32 /dev/urandom | base64 | tr -d '\n=' | tr '+/' '-_')
  cat >> "$ENV_FILE" <<EOF

# ── Chamadas (LiveKit, auto-hospedado) ───────────────────────────────────────
# O segredo assina os tokens de entrada e nunca sai deste servidor: o cliente
# recebe um token assinado, nunca a chave.
LIVEKIT_URL=wss://yo.alexandrelanda.com/livekit
LIVEKIT_API_KEY=$API_KEY
LIVEKIT_API_SECRET=$API_SECRET
EOF
  log "Chaves escritas em server/.env"
fi

# ── 3. Arrancar ──────────────────────────────────────────────────────────────
log "A arrancar o SFU (node-ip $IP)..."
LIVEKIT_NODE_IP="$IP" \
LIVEKIT_API_KEY="$API_KEY" \
LIVEKIT_API_SECRET="$API_SECRET" \
  docker compose -f "$COMPOSE" --profile calls up -d livekit

sleep 3
if ! docker compose -f "$COMPOSE" --profile calls ps livekit | grep -q "Up\|running"; then
  docker compose -f "$COMPOSE" --profile calls logs --tail 30 livekit
  die "o SFU não arrancou — ver o registo acima"
fi

# ── 4. As portas ─────────────────────────────────────────────────────────────
#
# Com o domínio a apontar diretamente para esta máquina, o média chega cá sem
# nada pelo meio — basta as portas estarem abertas. (Por um túnel isto não
# tinha solução: um túnel transporta HTTP e WebSockets, e o média é UDP.)
cat <<EOF

  SFU a correr.

  Falta abrir no teu fornecedor (e no ufw, se o usares):

      50000-60000/udp    áudio e vídeo
      7881/tcp           alternativa quando o UDP está bloqueado

  Com ufw:
      sudo ufw allow 50000:60000/udp
      sudo ufw allow 7881/tcp

  A sinalização (7880) passa pelo Caddy em /livekit. O média vai direto a
  estas portas, sem proxy — é UDP e nenhum proxy HTTP o transporta.

  Testar de outra máquina:
      nc -zvu $IP 50000

  Depois: reinicia o backend para ele ler as chaves novas.

EOF
