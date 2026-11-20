#!/usr/bin/env bash
# Run once on EC2 as root after DNS points at the instance:
#   sudo bash deploy/enable-ssl.sh [email]
# Issues a Let's Encrypt certificate via webroot, installs the TLS nginx config,
# and verifies automatic renewal.
set -Eeuo pipefail
DOMAIN=recipepick.duckdns.org
EMAIL=${1:-}
cd "$(dirname "$0")/.."

email_args=(--register-unsafely-without-email)
[ -n "$EMAIL" ] && email_args=(-m "$EMAIL" --no-eff-email)

certbot certonly --webroot -w /var/www/certbot -d "$DOMAIN" \
  "${email_args[@]}" --agree-tos --non-interactive

# certonly --webroot does not create certbot's shared nginx TLS defaults; copy them.
for f in options-ssl-nginx.conf ssl-dhparams.pem; do
  if [ ! -f "/etc/letsencrypt/$f" ]; then
    src="/usr/lib/python3/dist-packages/certbot_nginx/_internal/tls_configs/$f"
    [ -f "$src" ] || src="/usr/lib/python3/dist-packages/certbot/$f"
    cp "$src" "/etc/letsencrypt/$f"
  fi
done

install -m 644 deploy/nginx/recipepick.conf /etc/nginx/sites-available/recipepick
nginx -t
systemctl reload nginx
systemctl enable --now certbot.timer 2>/dev/null || true
certbot renew --dry-run
echo "HTTPS enabled for https://$DOMAIN"
