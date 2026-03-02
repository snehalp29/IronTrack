#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT_DIR"

if [[ ! -f ".env" ]]; then
  echo "[irontrack] Missing .env file. Copy .env.example to .env first."
  exit 1
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
  container_id="$("${COMPOSE_CMD[@]}" ps -q "$service")"

  if [[ -z "$container_id" ]]; then
    echo "[irontrack] Could not find container for service '$service'."
    exit 1
  fi

  local attempts=0
  local max_attempts=60
  while (( attempts < max_attempts )); do
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
wait_for_service ml
wait_for_service api

echo "[irontrack] Generating Prisma client..."
cd apps/api
npx prisma generate

echo "[irontrack] Applying Prisma migrations..."
npx prisma migrate deploy

echo "[irontrack] Seeding database..."
npx prisma db seed

echo "[irontrack] Setup complete."
