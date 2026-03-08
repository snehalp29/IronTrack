# Code Review — Infrastructure & Deployment

Scope: `infra/docker/Dockerfile.api`, `infra/docker/Dockerfile.web`, `infra/docker/docker-compose.yml`, `infra/docker/docker-compose.override.yml`, `infra/docker/.env.docker.example`, and the web runtime API bootstrap.

Status: `0 open`

Fixed: `#I-1–#I-13` added nginx SPA routing and runtime API URL injection, made compose run migrations before API boot, aligned API port handling around `3000`, added `host.docker.internal:host-gateway`, removed duplicate healthchecks, hardened local compose env/defaults, installed OpenSSL in the API image base, injected a build-only `DATABASE_URL` for `prisma generate`, and recovered the failed refresh-token uniqueness migration before repaired dedupe SQL runs.

Non-defect: `#I-9` remains valid as implemented because the dev web override binds Vite to port `80` inside a root-run container.

Outcomes: production web containers can refresh deep client routes without nginx 404s, one web image can be retargeted to a different API origin at startup instead of rebuild time, and compose startup order is safer for schema changes and Linux-host ML connectivity.

Validation: `docker compose -f infra/docker/docker-compose.yml -f infra/docker/docker-compose.override.yml config`, `pnpm docker:up`, `pnpm --filter @irontrack/web test`, and `pnpm --filter @irontrack/web typecheck`.
