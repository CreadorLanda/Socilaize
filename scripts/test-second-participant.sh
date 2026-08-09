#!/usr/bin/env bash
#
# Um segundo participante para testar chamadas, sem emulador nem segundo
# telemóvel: o browser do portátil entra na sala como outra conta.
#
# Funciona porque uma chamada de grupo corre sem a camada de cifra extra — a
# chave é derivada da sessão 1:1 e um grupo não tem uma. Numa chamada 1:1 o
# browser entrava na sala e não ouviria nada, o que seria pior do que não
# entrar: pareceria uma avaria em vez de uma limitação.
#
# Uso:
#   ./scripts/test-second-participant.sh            # cria/entra na conta de teste
#   ./scripts/test-second-participant.sh <chat-id>  # gera o link para essa sala
set -euo pipefail

API="${API:-https://yo.alexandrelanda.com/api}"
PHONE="${TEST_PHONE:-+244900000777}"

die() { printf '\n\033[1;31mERRO:\033[0m %s\n\n' "$*" >&2; exit 1; }
log() { printf '\n\033[1;36m==>\033[0m %s\n' "$*"; }

need() { command -v "$1" >/dev/null || die "falta $1"; }
need curl; need python3

# ── Sessão ───────────────────────────────────────────────────────────────────
#
# Depende de APP_ENV=dev no servidor, que devolve o código na resposta em vez
# de o enviar por SMS. Quando isso mudar, este script deixa de funcionar — e
# deve mesmo deixar, porque nessa altura entrar numa conta pelo número passa a
# ser um problema e não uma conveniência.
log "A entrar como conta de teste ($PHONE)..."
CODE=$(curl -s -X POST "$API/auth/start" -H 'content-type: application/json' \
       -d "{\"phone\":\"$PHONE\"}" \
     | python3 -c 'import sys,json; print(json.load(sys.stdin).get("dev_code",""))')
[[ -z "$CODE" ]] && die "o servidor não devolveu dev_code — APP_ENV não está em dev"

read -r TOKEN USER_ID USERNAME < <(curl -s -X POST "$API/auth/verify" \
  -H 'content-type: application/json' \
  -d "{\"phone\":\"$PHONE\",\"code\":\"$CODE\",\"device\":\"browser\",\"platform\":\"web\",\"device_key\":\"test-browser\"}" \
  | python3 -c 'import sys,json; d=json.load(sys.stdin); print(d["tokens"]["access_token"], d["user"]["id"], d["user"]["username"])')

[[ -z "${TOKEN:-}" ]] && die "não consegui autenticar"

CHAT="${1:-}"
if [[ -z "$CHAT" ]]; then
  cat <<EOF

  Conta de teste pronta.

      username   @$USERNAME
      id         $USER_ID

  No telemóvel:
    1. Cria um grupo (ou abre um que já tenhas)
    2. Adiciona @$USERNAME
    3. Copia o id da conversa — está no URL do ecrã, ou:

           ./scripts/test-second-participant.sh --list

    4. Corre outra vez com esse id para obteres o link do browser

EOF
  exit 0
fi

if [[ "$CHAT" == "--list" ]]; then
  log "Conversas desta conta de teste:"
  curl -s "$API/chats" -H "authorization: Bearer $TOKEN" \
   | python3 -c '
import sys, json
for c in json.load(sys.stdin):
    kind = c.get("type")
    title = c.get("title") or c.get("peer_username") or "(sem nome)"
    print(f"    {c[\"id\"]}  {kind:7} {title}")
' || die "não consegui listar"
  exit 0
fi

# ── O token da chamada ───────────────────────────────────────────────────────
#
# ring=0: estamos a atender, não a ligar. Pedir para tocar aqui faria o
# telemóvel do próprio testador tocar por causa do browser.
log "A pedir um token para a sala..."
GRANT=$(curl -s -X POST "$API/chats/$CHAT/call/token?mode=voice" \
        -H "authorization: Bearer $TOKEN")

python3 - "$GRANT" <<'PY'
import sys, json, urllib.parse
try:
    g = json.loads(sys.argv[1])
except Exception:
    print("  resposta inesperada:", sys.argv[1][:200]); raise SystemExit(1)
if "token" not in g:
    print("  o servidor recusou:", g)
    print("  (a conta de teste está nesse grupo?)")
    raise SystemExit(1)

url = g["url"]
q = urllib.parse.urlencode({"liveKitUrl": url, "token": g["token"]})
print(f"""
  Sala:  {g['room'][:8]}...
  SFU:   {url}

  Abre isto no browser do portátil:

      https://meet.livekit.io/custom?{q}

  Depois, no telemóvel, começa a chamada nesse grupo. As duas pontas ficam
  na mesma sala.

  O token dura 5 minutos — se demorares, corre o script outra vez.
""")
PY
