#!/usr/bin/env bash
#
# Generate self-signed CA + server + client certificates for mTLS between
# the Go API and the wa-bridge sidecar.
#
# Usage:  ./deploy/gen-certs.sh [output-dir]
#         Default output-dir is ./certs

set -euo pipefail

OUT="${1:-certs}"
mkdir -p "$OUT"

# ── 1. Certificate Authority ─────────────────────────────────────────────────
# The CA signs both the server and client certs. Keep the CA key safe in
# production; here we use it just for local dev.
if [ ! -f "$OUT/ca.pem" ]; then
    openssl req -x509 -new -nodes \
        -days 3650 \
        -subj "/CN=Socialize Dev CA/O=Socialize" \
        -keyout "$OUT/ca-key.pem" \
        -out "$OUT/ca.pem" 2>/dev/null
    echo "[ok] CA created"
fi

# ── 2. Server certificate (Go API) ───────────────────────────────────────────
# The server cert's SAN includes the hostnames the sidecar uses to reach us.
# In dev that's "localhost"; inside docker compose it's "api" (the service
# name). Add more DNS names as needed.
if [ ! -f "$OUT/server.pem" ]; then
    openssl req -new -nodes \
        -subj "/CN=Socialize API Server/O=Socialize" \
        -keyout "$OUT/server-key.pem" \
        -out "$OUT/server.csr" 2>/dev/null

    openssl x509 -req \
        -CA "$OUT/ca.pem" \
        -CAkey "$OUT/ca-key.pem" \
        -CAcreateserial \
        -days 365 \
        -in "$OUT/server.csr" \
        -out "$OUT/server.pem" 2>/dev/null \
        -extfile <(cat <<EOF
basicConstraints       = CA:FALSE
subjectKeyIdentifier   = hash
authorityKeyIdentifier = keyid:always,issuer:always
keyUsage               = digitalSignature,keyEncipherment
extendedKeyUsage       = serverAuth
subjectAltName         = DNS:localhost,DNS:api,DNS:host.docker.internal,IP:127.0.0.1
EOF
)
    rm -f "$OUT/server.csr"
    echo "[ok] Server cert created"
fi

# ── 3. Client certificate (wa-bridge) ────────────────────────────────────────
if [ ! -f "$OUT/client.pem" ]; then
    openssl req -new -nodes \
        -subj "/CN=Socialize WA Bridge Client/O=Socialize" \
        -keyout "$OUT/client-key.pem" \
        -out "$OUT/client.csr" 2>/dev/null

    openssl x509 -req \
        -CA "$OUT/ca.pem" \
        -CAkey "$OUT/ca-key.pem" \
        -CAcreateserial \
        -days 365 \
        -in "$OUT/client.csr" \
        -out "$OUT/client.pem" 2>/dev/null \
        -extfile <(cat <<EOF
basicConstraints       = CA:FALSE
subjectKeyIdentifier   = hash
authorityKeyIdentifier = keyid:always,issuer:always
keyUsage               = digitalSignature
extendedKeyUsage       = clientAuth
EOF
)
    rm -f "$OUT/client.csr"
    echo "[ok] Client cert created"
fi

# ── 4. Permissions ──────────────────────────────────────────────────────────
chmod 600 "$OUT/"*-key.pem
chmod 644 "$OUT/"ca.pem "$OUT/"server.pem "$OUT/client.pem"

echo
echo "── Certificate tree ──────────────────────────────────────"
ls -la "$OUT/"
echo
echo "🔒  mTLS certs ready in $OUT/"
echo "    Add these paths to your .env file:"
echo "      TLS_CA_CERT=$OUT/ca.pem"
echo "      TLS_SERVER_CERT=$OUT/server.pem"
echo "      TLS_SERVER_KEY=$OUT/server-key.pem"
echo "      TLS_CLIENT_CERT=$OUT/client.pem"
echo "      TLS_CLIENT_KEY=$OUT/client-key.pem"
echo "      WA_INTERNAL_ADDR=:9090"
echo "      WA_WEBHOOK_URL=https://host.docker.internal:9090/api/internal/wa/events"
