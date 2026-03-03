#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT_DIR"

COMPOSE_BASE="infra/docker/docker-compose.yml"
COMPOSE_OVERRIDE="infra/docker/docker-compose.override.yml"
DOCKER_ENV_FILE="infra/docker/.env.docker"
DOCKER_ENV_EXAMPLE_FILE="infra/docker/.env.docker.example"

ENV_FILE=".env"
if [[ ! -f "$ENV_FILE" ]]; then
  ENV_FILE=".env.example"
fi

check_single_env_source_of_truth() {
  local file="$1"

  awk '
  BEGIN {
    in_services = 0;
    service = "";
    has_env_file = 0;
    has_environment = 0;
    has_error = 0;
  }

  function emit_if_invalid() {
    if (service != "" && has_env_file && has_environment) {
      printf "[docker-validate] %s: service \"%s\" defines both env_file and environment. Use one source of truth.\n", FILENAME, service > "/dev/stderr";
      has_error = 1;
    }
  }

  /^services:[[:space:]]*$/ {
    in_services = 1;
    next;
  }

  in_services && /^[^[:space:]]/ {
    emit_if_invalid();
    in_services = 0;
    service = "";
    next;
  }

  in_services && /^  [A-Za-z0-9_.-]+:[[:space:]]*$/ {
    emit_if_invalid();
    service = $1;
    sub(/:$/, "", service);
    has_env_file = 0;
    has_environment = 0;
    next;
  }

  in_services && service != "" && /^    env_file:[[:space:]]*$/ {
    has_env_file = 1;
    next;
  }

  in_services && service != "" && /^    environment:[[:space:]]*$/ {
    has_environment = 1;
    next;
  }

  END {
    emit_if_invalid();
    if (has_error) {
      exit 1;
    }
  }
  ' "$file"
}

require_env_key() {
  local file="$1"
  local key="$2"
  local value

  value="$(sed -n "s/^${key}=//p" "$file" | tail -n1)"
  if [[ -z "$value" ]]; then
    echo "[docker-validate] ${file}: missing required key ${key}." >&2
    exit 1
  fi

  printf '%s' "$value"
}

ensure_docker_env_file() {
  if [[ -f "$DOCKER_ENV_FILE" ]]; then
    return
  fi

  if [[ ! -f "$DOCKER_ENV_EXAMPLE_FILE" ]]; then
    echo "[docker-validate] Missing ${DOCKER_ENV_FILE} and ${DOCKER_ENV_EXAMPLE_FILE}." >&2
    exit 1
  fi

  cp "$DOCKER_ENV_EXAMPLE_FILE" "$DOCKER_ENV_FILE"
  echo "[docker-validate] Created ${DOCKER_ENV_FILE} from ${DOCKER_ENV_EXAMPLE_FILE}."
}

ensure_docker_env_file_not_tracked() {
  if git ls-files --error-unmatch "$DOCKER_ENV_FILE" >/dev/null 2>&1; then
    echo "[docker-validate] ${DOCKER_ENV_FILE} is tracked in git. Keep it untracked and commit only ${DOCKER_ENV_EXAMPLE_FILE}." >&2
    exit 1
  fi
}

validate_docker_jwt_secrets() {
  local env_file="$DOCKER_ENV_FILE"
  local access_secret
  local refresh_secret

  access_secret="$(require_env_key "$env_file" "JWT_ACCESS_SECRET")"
  refresh_secret="$(require_env_key "$env_file" "JWT_REFRESH_SECRET")"

  if (( ${#access_secret} < 24 )); then
    echo "[docker-validate] ${env_file}: JWT_ACCESS_SECRET should be at least 24 characters." >&2
    exit 1
  fi

  if (( ${#refresh_secret} < 24 )); then
    echo "[docker-validate] ${env_file}: JWT_REFRESH_SECRET should be at least 24 characters." >&2
    exit 1
  fi

  if [[ "$access_secret" == "$refresh_secret" ]]; then
    echo "[docker-validate] ${env_file}: JWT_ACCESS_SECRET and JWT_REFRESH_SECRET must differ." >&2
    exit 1
  fi
}

echo "[docker-validate] Checking env source-of-truth in compose files..."
check_single_env_source_of_truth "$COMPOSE_BASE"
check_single_env_source_of_truth "$COMPOSE_OVERRIDE"

ensure_docker_env_file

ensure_docker_env_file_not_tracked

echo "[docker-validate] Validating docker JWT secret defaults..."
validate_docker_jwt_secrets

echo "[docker-validate] Rendering base compose config with ${ENV_FILE}..."
docker compose --env-file "$ENV_FILE" -f "$COMPOSE_BASE" config >/dev/null

echo "[docker-validate] Rendering base+override compose config with ${ENV_FILE}..."
docker compose --env-file "$ENV_FILE" -f "$COMPOSE_BASE" -f "$COMPOSE_OVERRIDE" config >/dev/null

echo "[docker-validate] Docker configuration validation passed."
