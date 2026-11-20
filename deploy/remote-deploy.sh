#!/usr/bin/env bash
# Invoked by GitHub Actions on EC2. Retains the active release on any failure.
set -Eeuo pipefail
: "${PROJECT_DIR:?missing PROJECT_DIR}"
: "${RELEASE:?missing RELEASE}"
release_dir="$PROJECT_DIR/releases/$RELEASE"
current_link="$PROJECT_DIR/current"
previous=$(readlink "$current_link" 2>/dev/null || true)

rollback() {
  echo "Deployment failed; restoring previous release" >&2
  if [ -n "$previous" ] && [ "$previous" != "$release_dir" ] && [ -d "$previous" ]; then
    ln -sfn "$previous" "$current_link"
    cd "$current_link"
    docker compose -p recipepick -f docker-compose.yml -f deploy/docker-compose.ec2.yml up -d --build --remove-orphans || true
  fi
}
trap rollback ERR

test -f "$release_dir/docker-compose.yml"
test -f /etc/recipepick/recipepick.env
ln -sfn "$release_dir" "$current_link"
cd "$current_link"
docker compose -p recipepick -f docker-compose.yml -f deploy/docker-compose.ec2.yml up -d --build --remove-orphans
for _ in $(seq 1 18); do
  if curl -fsS --max-time 5 http://127.0.0.1:8000/api/health >/dev/null; then
    docker image prune -f >/dev/null
    find "$PROJECT_DIR/releases" -mindepth 1 -maxdepth 1 -type d -printf '%T@ %p\n' | sort -rn | tail -n +6 | cut -d' ' -f2- | xargs -r rm -rf
    exit 0
  fi
  sleep 5
done
false
