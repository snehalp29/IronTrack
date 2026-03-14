#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT_DIR/apps/api"

echo "[irontrack] Resetting database..."
npx prisma migrate reset --force --skip-generate
npx prisma generate
npx prisma db seed

echo "[irontrack] Database reset complete."
