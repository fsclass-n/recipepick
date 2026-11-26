#!/usr/bin/env bash
# Invoked by GitHub Actions on EC2. Retains the active release on any failure.
set -Eeuo pipefail
: "${PROJECT_DIR:?missing PROJECT_DIR}"
: "${RELEASE:?missing RELEASE}"
PROJECT_DIR=$(cd "$PROJECT_DIR" && pwd)
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
# Playwright 이미지가 커서 빌드 캐시가 쌓이면 디스크가 가득 찬다: 여유 6GB 미만이면 캐시를 먼저 정리
if [ "$(df --output=avail -k / | tail -1)" -lt 6000000 ]; then
  docker builder prune -af >/dev/null 2>&1 || true
  docker image prune -f >/dev/null 2>&1 || true
fi
ln -sfn "$release_dir" "$current_link"
cd "$current_link"
docker compose -p recipepick -f docker-compose.yml -f deploy/docker-compose.ec2.yml up -d --build --remove-orphans
for _ in $(seq 1 18); do
  if curl -fsS --max-time 5 http://127.0.0.1:8000/api/health >/dev/null; then
    docker image prune -f >/dev/null
    docker builder prune -af >/dev/null 2>&1 || true
    find "$PROJECT_DIR/releases" -mindepth 1 -maxdepth 1 -type d -printf '%T@ %p\n' | sort -rn | tail -n +6 | cut -d' ' -f2- | xargs -r rm -rf
    exit 0
  fi
  sleep 5
done
false
