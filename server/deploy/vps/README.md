# VPS deployment helpers

Files in this directory are templates for the **hybrid topology** (Postgres on Supabase, everything else on a single VPS — Oracle Always-Free Ampere is the target). Full step-by-step in [docs/tech/deployment.md](../../../docs/tech/deployment.md).

| File                       | Purpose                                                       |
|----------------------------|---------------------------------------------------------------|
| `Caddyfile`                | Reverse proxy + automatic Let's Encrypt TLS, in front of the API |
| `yo-api.service`    | Hardened systemd unit for the Go binary                       |

Both files have inline comments explaining install steps. The minimum sequence on a fresh Ubuntu/Debian VPS is:

```bash
# 1. System user + directories
sudo useradd -r -s /usr/sbin/nologin -d /opt/yo socialize
sudo mkdir -p /opt/yo/bin
sudo chown -R socialize:socialize /opt/yo

# 2. Drop the API binary + .env
sudo install -o socialize -g socialize -m 755 bin/api /opt/yo/bin/api
sudo install -o socialize -g socialize -m 600 .env   /opt/yo/.env

# 3. Systemd
sudo cp deploy/vps/yo-api.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now socialize-api

# 4. Caddy reverse proxy + TLS
sudo apt install -y caddy
sudo cp deploy/vps/Caddyfile /etc/caddy/Caddyfile
sudo systemctl reload caddy

# 5. Redis on the VPS (in Docker, single container)
sudo docker compose -f deploy/docker/docker-compose.yml up -d redis
```

Once the DNS for your domain points at the VPS, Caddy issues a cert on the first request and `https://api.<domain>/api/healthz` returns 200.
