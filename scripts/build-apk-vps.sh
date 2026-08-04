#!/usr/bin/env bash
# build-apk-vps.sh — roda na VPS, gera APK e serve para download
# Uso na VPS: ./scripts/build-apk-vps.sh [--serve]

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
MOBILE_DIR="$ROOT_DIR/mobile"
BUILD_DIR="$ROOT_DIR/build-apk"
PUBLIC_DIR="$BUILD_DIR/public"

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

log() { echo -e "${GREEN}[build-apk]${NC} $*"; }
warn() { echo -e "${YELLOW}[build-apk]${NC} $*"; }
err() { echo -e "${RED}[build-apk]${NC} $*" >&2; }

# Detecta IP público da VPS
PUBLIC_IP=$(curl -s ifconfig.me || curl -s icanhazip.com || hostname -I | awk '{print $1}')
log "IP público da VPS: $PUBLIC_IP"

# 1. Prepara ambiente
log "Instalando dependências (Node, Java, Android SDK)..."
export DEBIAN_FRONTEND=noninteractive
apt update -qq
apt install -y -qq openjdk-17-jdk-headless unzip curl wget git 2>/dev/null || true

# Node 20 + bun
if ! command -v bun &>/dev/null; then
  curl -fsSL https://bun.sh/install | bash
  export PATH="$HOME/.bun/bin:$PATH"
fi

# Android SDK (command line tools)
ANDROID_SDK_ROOT="/opt/android-sdk"
if [[ ! -d "$ANDROID_SDK_ROOT" ]]; then
  log "Baixando Android SDK..."
  mkdir -p "$ANDROID_SDK_ROOT/cmdline-tools"
  cd /tmp
  wget -q "https://dl.google.com/android/repository/commandlinetools-linux-11076708_latest.zip" -O cmdtools.zip
  unzip -q cmdtools.zip -d "$ANDROID_SDK_ROOT/cmdline-tools"
  mv "$ANDROID_SDK_ROOT/cmdline-tools/cmdline-tools" "$ANDROID_SDK_ROOT/cmdline-tools/latest"
  rm cmdtools.zip
fi

export ANDROID_SDK_ROOT
export PATH="$ANDROID_SDK_ROOT/cmdline-tools/latest/bin:$ANDROID_SDK_ROOT/platform-tools:$PATH"

# Aceita licenças e instala componentes
yes | sdkmanager --licenses >/dev/null 2>&1 || true
sdkmanager "platform-tools" "platforms;android-34" "build-tools;34.0.0" "ndk;26.1.10909125" >/dev/null 2>&1

# 2. Configura mobile/.env com IP público da VPS
log "Configurando mobile/.env para API em https://api.seudominio.com (ou IP)..."
cat > "$MOBILE_DIR/.env" <<EOF
# Gerado por build-apk-vps.sh em $(date)
EXPO_PUBLIC_API_URL=https://api.seudominio.com
EXPO_PUBLIC_WS_URL=wss://api.seudominio.com
EOF

# 3. Instala deps e builda
cd "$MOBILE_DIR"
log "Instalando dependências..."
bun install --frozen-lockfile 2>/dev/null || bun install

log "Configurando EAS (precisa de EAS_TOKEN ou login)..."
if [[ -z "${EAS_TOKEN:-}" ]]; then
  warn "EAS_TOKEN não definido. Use: export EAS_TOKEN='seu-token' ou faça login manual antes."
  warn "Build local (expo run:android) será usado como fallback."
  BUILD_LOCAL=true
else
  BUILD_LOCAL=false
  npx eas-cli build --platform android --profile preview --non-interactive --token "$EAS_TOKEN" 2>&1 | tee "$BUILD_DIR/eas-build.log"
fi

if [[ "$BUILD_LOCAL" == "true" ]]; then
  log "Build local com Gradle (pode demorar 10-20 min na primeira vez)..."
  # Gera projeto nativo se não existir
  [[ -d android ]] || npx expo prebuild --platform android --clean
  
  # Build release APK
  cd android
  ./gradlew assembleRelease --no-daemon 2>&1 | tee "$BUILD_DIR/gradle-build.log"
  
  # Copia APK gerado
  APK_PATH=$(find . -name "*-release.apk" -type f | head -1)
  if [[ -n "$APK_PATH" ]]; then
    mkdir -p "$PUBLIC_DIR"
    cp "$APK_PATH" "$PUBLIC_DIR/socialize-$(date +%Y%m%d-%H%M%S).apk"
    log "APK gerado: $PUBLIC_DIR/$(basename "$APK_PATH")"
  else
    err "APK não encontrado após build"
    exit 1
  fi
fi

# 4. Se build EAS, baixa o artifact
if [[ "$BUILD_LOCAL" == "false" ]]; then
  log "Baixando APK do EAS..."
  # O EAS CLI não tem download direto via CLI simples
  # Use: eas build:list --platform android --limit 1 --json
  # Para automatizar, configure EAS para subir para artifact storage (S3, GCS, etc)
  warn "Build EAS iniciado. Acompanhe em: https://expo.dev/accounts/<seu-user>/projects/socialize/builds"
  warn "Configure 'build:artifact' no eas.json para upload automático, ou baixe manualmente do Expo dashboard."
fi

# 5. Serve APK para download (opcional)
if [[ "${1:-}" == "--serve" ]]; then
  mkdir -p "$PUBLIC_DIR"
  cd "$PUBLIC_DIR"
  
  # Gera index.html simples
  cat > index.html <<EOF
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Socialize APK Download</title>
  <style>
    body { font-family: system-ui; max-width: 600px; margin: 2rem auto; padding: 1rem; text-align: center; }
    .apk-link { display: inline-block; background: #007AFF; color: white; padding: 1rem 2rem; border-radius: 8px; text-decoration: none; font-size: 1.1rem; margin: 1rem 0; }
    .apk-link:hover { background: #0056CC; }
    .qr { margin: 2rem 0; }
    code { background: #f5f5f5; padding: 0.2rem 0.4rem; border-radius: 4px; }
  </style>
</head>
<body>
  <h1>📱 Socialize - APK para Teste</h1>
  <p>Escaneie o QR code ou clique no botão para baixar:</p>
  <div class="qr">
    <img src="https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=https://$PUBLIC_IP/apk/$(ls *.apk 2>/dev/null | head -1)" alt="QR Code">
  </div>
  <a class="apk-link" href="/apk/$(ls *.apk 2>/dev/null | head -1)" download>⬇️ Baixar APK</a>
  <p><small>IP da VPS: $PUBLIC_IP</small></p>
  <p><small>Build: $(date)</small></p>
</body>
</html>
EOF

  log "Servindo em http://$PUBLIC_IP:8080 ..."
  python3 -m http.server 8080 --directory "$PUBLIC_DIR" &
  SERVE_PID=$!
  trap "kill $SERVE_PID 2>/dev/null" EXIT
  
  echo
  echo "=========================================="
  echo "  APK DISPONÍVEL PARA DOWNLOAD"
  echo "=========================================="
  echo "URL: http://$PUBLIC_IP:8080"
  echo "QR Code gerado na página"
  echo
  echo "Compartilhe este link com os testadores"
  echo "=========================================="
  
  wait $SERVE_PID
fi

log "Concluído!"