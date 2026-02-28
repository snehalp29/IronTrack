#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT_DIR"

echo "[irontrack] Starting docker services..."
docker compose -f infra/docker/docker-compose.yml up -d --build

echo "[irontrack] Running Prisma migration..."
cd apps/api
npx prisma migrate dev --name init --skip-seed

echo "[irontrack] Seeding database..."
npx prisma db seed

echo "[irontrack] Setup complete."
