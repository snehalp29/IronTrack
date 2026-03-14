#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT_DIR"

if [[ ! -f ".env" ]]; then
  echo "[irontrack] Missing .env file. Copy .env.example to .env first."
  exit 1
fi

if [[ ! -f "infra/docker/.env.docker" ]]; then
  if [[ -f "infra/docker/.env.docker.example" ]]; then
    cp infra/docker/.env.docker.example infra/docker/.env.docker
    echo "[irontrack] Created infra/docker/.env.docker from .env.docker.example."
  else
    echo "[irontrack] Missing infra/docker/.env.docker and .env.docker.example."
    exit 1
  fi
fi

if ! command -v pnpm >/dev/null 2>&1; then
  echo "[irontrack] pnpm is required but was not found in PATH."
  exit 1
fi

echo "[irontrack] Installing JavaScript dependencies..."
pnpm install --no-frozen-lockfile

COMPOSE_CMD=(docker compose --env-file .env -f infra/docker/docker-compose.yml)

wait_for_service() {
  local service="$1"
  local container_id

  local attempts=0
  local max_attempts=60
  while (( attempts < max_attempts )); do
    container_id="$("${COMPOSE_CMD[@]}" ps -q "$service")"
    if [[ -z "$container_id" ]]; then
      attempts=$((attempts + 1))
      sleep 2
      continue
    fi

    local status
    status="$(docker inspect --format='{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}' "$container_id" 2>/dev/null || true)"

    if [[ "$status" == "healthy" || "$status" == "running" ]]; then
      echo "[irontrack] Service '$service' is ready ($status)."
      return 0
    fi

    if [[ "$status" == "unhealthy" || "$status" == "exited" || "$status" == "dead" ]]; then
      echo "[irontrack] Service '$service' failed to start (status: $status)."
      "${COMPOSE_CMD[@]}" logs "$service" || true
      exit 1
    fi

    attempts=$((attempts + 1))
    sleep 2
  done

  echo "[irontrack] Timed out waiting for service '$service' to become ready."
  "${COMPOSE_CMD[@]}" logs "$service" || true
  exit 1
}

echo "[irontrack] Starting docker services..."
"${COMPOSE_CMD[@]}" up -d --build

echo "[irontrack] Waiting for services to become healthy..."
wait_for_service postgres

echo "[irontrack] Generating Prisma client..."
cd apps/api
npx prisma generate

echo "[irontrack] Applying Prisma migrations..."
npx prisma migrate deploy

echo "[irontrack] Seeding database..."
npx prisma db seed

cd "$ROOT_DIR"
echo "[irontrack] Waiting for API service to become healthy..."
wait_for_service api

echo "[irontrack] Setup complete."
