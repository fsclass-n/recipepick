#!/usr/bin/env bash
# Run once on Ubuntu EC2 as its login user: bash deploy/bootstrap-ec2.sh
set -Eeuo pipefail
DOMAIN=recipepick.duckdns.org
PROJECT_DIR=${PROJECT_DIR:-/opt/recipepick}
sudo apt-get update
sudo apt-get install -y ca-certificates curl docker.io docker-compose-v2 nginx certbot python3-certbot-nginx
# Small instances (~1 GiB) need swap for Docker/npm builds.
if ! swapon --show | grep -q /swapfile; then
  sudo fallocate -l 2G /swapfile
  sudo chmod 600 /swapfile
  sudo mkswap /swapfile
  sudo swapon /swapfile
  grep -q '^/swapfile' /etc/fstab || echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
fi
sudo systemctl enable --now docker nginx
sudo usermod -aG docker "$USER"
sudo install -d -m 750 -o "$USER" -g "$USER" "$PROJECT_DIR" "$PROJECT_DIR/releases"
sudo install -d -m 750 /etc/recipepick /var/lib/recipepick /var/www/certbot
sudo install -m 700 deploy/duckdns-update.sh /usr/local/sbin/recipepick-duckdns-update
sudo install -m 644 deploy/systemd/recipepick-duckdns.service /etc/systemd/system/
sudo install -m 644 deploy/systemd/recipepick-duckdns.timer /etc/systemd/system/
# HTTP-only vhost first; enable-ssl.sh installs the TLS vhost after cert issuance.
sudo cp deploy/nginx/recipepick-init.conf /etc/nginx/sites-available/recipepick
sudo ln -sfn /etc/nginx/sites-available/recipepick /etc/nginx/sites-enabled/recipepick
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t
sudo systemctl reload nginx
sudo systemctl daemon-reload
sudo systemctl enable --now recipepick-duckdns.timer
echo "Create /etc/recipepick/{recipepick.env,duckdns.env} (mode 600), start the"
echo "DuckDNS updater, wait for DNS, then run: sudo bash deploy/enable-ssl.sh"
