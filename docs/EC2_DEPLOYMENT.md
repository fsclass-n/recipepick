# EC2 production deployment

This repository keeps Netlify and Render untouched. EC2 is an additional target:
host Nginx terminates TLS and proxies the SPA to `127.0.0.1:5173`, `/api/` and
`/ws` to `127.0.0.1:8000`. Docker ports are loopback-only.

## One-time server setup

1. In the EC2 security group allow TCP 80/443 from the internet and restrict TCP
   22 to an administrator IP. Do not expose 8000 or 5173.
2. SSH to the Ubuntu instance, transfer/clone this source once, and run
   `bash deploy/bootstrap-ec2.sh`. Re-login afterwards so the Docker group takes effect.
3. Create `/etc/recipepick/recipepick.env` from `deploy/recipepick.env.example`
   and `/etc/recipepick/duckdns.env` from `deploy/duckdns.env.example`; run
   `sudo chmod 600 /etc/recipepick/*.env`. Keep existing TiDB values unchanged.
   `recipepick.env` must be readable by the deploy user (`root:docker`, mode 640).
   Note: Compose `env_file` does not strip inline comments — keep values bare.
4. Verify `sudo systemctl start recipepick-duckdns.service`, wait for DNS to point
   at EC2, then issue TLS and install the HTTPS vhost:
   `sudo bash deploy/enable-ssl.sh [email]`. It runs `certbot certonly --webroot`,
   swaps the init vhost for `deploy/nginx/recipepick.conf`, enables `certbot.timer`,
   and runs `certbot renew --dry-run`.

## GitHub configuration

Create these **Actions environment secrets** in `production`: `EC2_HOST`,
`EC2_USER`, `EC2_SSH_KEY`, `EC2_PORT`, and `EC2_PROJECT_PATH` (normally
`/opt/recipepick`). A push to `main` then uploads an immutable release and runs
`deploy/remote-deploy.sh`. It waits for `/api/health`; failure restores the prior
release. The server does not need a GitHub deploy key.

## Database

EC2 uses AWS RDS via `DATABASE_URL` in `/etc/recipepick/recipepick.env`
(`mysql+pymysql://...`), which takes precedence over `TIDB_*`. Because RDS
serves an Amazon CA that certifi does not carry, `DB_SSL_MODE=disabled` is set
for the private VPC link; the default `required` keeps TiDB's TLS verification
everywhere else (Render is unaffected). Tables are created automatically at
startup (`Base.metadata.create_all`) and test accounts are seeded on a fresh
schema. `/api/health` reports `tidb`, `mysql`, or `sqlite` from the resolved
host.

## Operations

- DNS updater runs after boot and every five minutes; logs: `journalctl -u recipepick-duckdns.service`.
- App status: `cd /opt/recipepick/current && docker compose -p recipepick -f docker-compose.yml -f deploy/docker-compose.ec2.yml ps`.
- Nginx: `sudo nginx -t && sudo systemctl reload nginx`.
- Elastic IP avoids DNS propagation delay but may incur AWS charges when allocated
  and unattached. This implementation uses free DuckDNS updates and creates no AWS resources.

Actual issuance, DNS modification, and deployment require the EC2 login identity,
DuckDNS token, populated production environment file, and GitHub secret access.
