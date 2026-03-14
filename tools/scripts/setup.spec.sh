#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/../.." && pwd)"
TARGET="$ROOT_DIR/tools/scripts/setup.sh"

if [[ ! -f "$TARGET" ]]; then
  echo "missing setup script: $TARGET"
  exit 1
fi

if ! awk '
  /wait_for_service\(\)/ { in_fn=1 }
  in_fn && /while \(\( attempts < max_attempts \)\); do/ { in_loop=1 }
  in_fn && in_loop && /COMPOSE_CMD\[@\].*ps -q "\$service"/ { found_refresh=1 }
  in_fn && in_loop && /^  done$/ {
    if (found_refresh) {
      exit 0
    }
    exit 1
  }
' "$TARGET"; then
  echo "wait_for_service must refresh container_id inside the retry loop"
  exit 1
fi

echo "setup.sh wait_for_service loop refresh check passed"
