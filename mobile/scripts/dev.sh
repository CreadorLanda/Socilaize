#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SERVER_DIR="$(cd "$ROOT/../server" && pwd)"
ENV_FILE="$ROOT/.env"
LOG_FILE="$ROOT/.server.log"

# ── 1. Detect local IP ──────────────────────────────────────────────────────
detect_ip() {
  if command -v ipconfig &>/dev/null; then
    ipconfig getifaddr en0 2>/dev/null && return
    ipconfig getifaddr en1 2>/dev/null && return
  fi
  if command -v hostname &>/dev/null; then
    local ip
    ip=$(hostname -I 2>/dev/null | awk '{print $1}')
    [[ -n "$ip" ]] && echo "$ip" && return
  fi
  if command -v ip &>/dev/null; then
    ip route get 1 2>/dev/null | awk '{print $NF; exit}' && return
  fi
  if command -v ifconfig &>/dev/null; then
    ifconfig 2>/dev/null | grep -E 'inet (addr:)?([0-9]+\.[0-9]+\.[0-9]+\.[0-9]+)' | grep -v '127.0.0.1' | head -1 | sed -E 's/.*inet (addr:)?([0-9.]+).*/\2/' && return
  fi
  echo "127.0.0.1"
}

cleanup() {
  echo ""
  echo "→ A parar servidor (PID $SERVER_PID)…"
  kill "$SERVER_PID" 2>/dev/null || true
  exit 0
}
trap cleanup SIGINT SIGTERM

IP=$(detect_ip)
echo "━━━ Socialize Dev ━━━━━━━━━━━━━━━━━"
echo " IP:      $IP"
echo " Server:  http://$IP:8080"
echo " Logs:    $LOG_FILE"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# ── 2. Write .env ───────────────────────────────────────────────────────────
echo "EXPO_PUBLIC_API_URL=http://$IP:8080" > "$ENV_FILE"

# ── 3. Start server (background, logs para ficheiro) ────────────────────────
if [[ -f "$SERVER_DIR/Makefile" ]]; then
  echo ""
  echo "→ A iniciar servidor (make dev)…"
  (cd "$SERVER_DIR" && make dev) > "$LOG_FILE" 2>&1 &
  SERVER_PID=$!
  sleep 2

  if ! kill -0 "$SERVER_PID" 2>/dev/null; then
    echo "  ⚠  Servidor parece ter falhado — vê $LOG_FILE"
  else
    echo "  ✓ Servidor OK (PID $SERVER_PID)"
  fi
fi

# ── 4. Start mobile (expo mostra QR code aqui) ──────────────────────────────
echo ""
echo "→ A iniciar mobile…"
echo ""
cd "$ROOT" && bun run start
