#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT_DIR"

if [[ ! -f ".env" ]]; then
  echo "[irontrack] Missing .env file. Copy .env.example to .env first."
  exit 1
fi

echo "[irontrack] Starting docker services..."
docker compose --env-file .env -f infra/docker/docker-compose.yml up -d --build

echo "[irontrack] Running Prisma migration..."
cd apps/api
npx prisma migrate dev --name init --skip-seed

echo "[irontrack] Seeding database..."
npx prisma db seed

echo "[irontrack] Setup complete."
