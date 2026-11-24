#!/bin/sh
# MikrotikEasy installer: sh install.sh   (run as a user that can use docker)
# Order: a prebuilt image file next to this script -> the published image -> build from source.
set -eu
cd "$(dirname "$0")"

command -v docker >/dev/null 2>&1 || { echo "Docker is not installed: https://docs.docker.com/engine/install/"; exit 1; }
if docker compose version >/dev/null 2>&1; then DC="docker compose"
elif command -v docker-compose >/dev/null 2>&1; then DC="docker-compose"
else echo "Docker Compose is missing (install the docker-compose-plugin package)."; exit 1; fi

if [ ! -f .env ]; then
  cp .env.example .env && chmod 600 .env
  echo "Created .env - fill in AI_ENABLED / LLM_* there if you want the AI tab (the Master works without it)."
fi

val() { sed -n "s/^$1=//p" .env | tail -n 1; }
DATA_DIR="$(val DATA_DIR)"; DATA_DIR="${DATA_DIR:-/home/${USER:-$(id -un)}/docker/mikrotikeasy/data}"
PORT="$(val APP_PORT)"; PORT="${PORT:-3090}"
mkdir -p "$DATA_DIR"
export USER="${USER:-$(id -un)}"

IMG="$(ls mikrotikeasy-image-*.tar* 2>/dev/null | tail -n 1 || true)"
if [ -n "$IMG" ]; then
  echo "Loading $IMG ..."; docker load -i "$IMG"; $DC up -d
elif $DC pull -q 2>/dev/null; then
  $DC up -d
else
  echo "Published image not reachable - building from source ..."
  $DC -f docker-compose.yml -f docker-compose.build.yml up -d --build
fi

printf 'Waiting for the app'
i=0
until docker exec mikrotikeasy wget -qO- http://127.0.0.1:3090/healthz >/dev/null 2>&1; do
  i=$((i + 1)); [ "$i" -gt 30 ] && { echo; echo "Not healthy yet - check: $DC logs"; exit 1; }
  printf '.'; sleep 1
done
IP="$(hostname -I 2>/dev/null | awk '{print $1}')"
echo; echo "MikrotikEasy is running: http://${IP:-localhost}:${PORT}"
