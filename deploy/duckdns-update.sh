#!/usr/bin/env bash
# Updates only when EC2's public IPv4 differs from DuckDNS' current record.
set -Eeuo pipefail
ENV_FILE=/etc/recipepick/duckdns.env
STATE_FILE=/var/lib/recipepick/duckdns-ip
LOG_TAG=recipepick-duckdns

source "$ENV_FILE"
: "${DUCKDNS_DOMAIN:?missing DUCKDNS_DOMAIN}"
: "${DUCKDNS_TOKEN:?missing DUCKDNS_TOKEN}"
mkdir -p "$(dirname "$STATE_FILE")"

for attempt in 1 2 3; do
  # IMDSv2 (token) first; fall back to an external checker if metadata is unavailable.
  imds_token=$(curl -fsS -X PUT --connect-timeout 3 --max-time 8 \
    -H "X-aws-ec2-metadata-token-ttl-seconds: 60" \
    http://169.254.169.254/latest/api/token 2>/dev/null || true)
  public_ip=""
  if [ -n "$imds_token" ]; then
    public_ip=$(curl -4fsS --connect-timeout 5 --max-time 15 \
      -H "X-aws-ec2-metadata-token: $imds_token" \
      http://169.254.169.254/latest/meta-data/public-ipv4 2>/dev/null || true)
  fi
  [ -n "$public_ip" ] || public_ip=$(curl -4fsS --connect-timeout 5 --max-time 15 https://checkip.amazonaws.com 2>/dev/null | tr -d '[:space:]' || true)
  if [[ "$public_ip" =~ ^([0-9]{1,3}\.){3}[0-9]{1,3}$ ]]; then
    previous=$(cat "$STATE_FILE" 2>/dev/null || true)
    dns_ip=$(getent ahostsv4 "${DUCKDNS_DOMAIN}.duckdns.org" 2>/dev/null | awk 'NR==1 {print $1}' || true)
    if [ "$public_ip" = "$previous" ] && [ "$public_ip" = "$dns_ip" ]; then
      logger -t "$LOG_TAG" "unchanged: $public_ip"
      exit 0
    fi
    response=$(curl -fsS --retry 3 --retry-all-errors --connect-timeout 5 --max-time 20 \
      "https://www.duckdns.org/update?domains=${DUCKDNS_DOMAIN}&token=${DUCKDNS_TOKEN}&ip=${public_ip}")
    if [ "$response" = "OK" ]; then
      printf '%s\n' "$public_ip" > "$STATE_FILE"
      chmod 600 "$STATE_FILE"
      logger -t "$LOG_TAG" "updated ${DUCKDNS_DOMAIN}.duckdns.org to $public_ip"
      exit 0
    fi
    logger -t "$LOG_TAG" "DuckDNS rejected update (attempt $attempt)"
  fi
  sleep $((attempt * 5))
done
logger -t "$LOG_TAG" "unable to determine or update public IP"
exit 1
