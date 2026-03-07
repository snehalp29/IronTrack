# Code Review — Infrastructure & Deployment

Scope: `infra/docker/Dockerfile.api`, `infra/docker/Dockerfile.web`, `infra/docker/docker-compose.yml`, `infra/docker/docker-compose.override.yml`, `infra/docker/.env.docker.example`, and the web runtime API bootstrap.

Status: `0 open`

Fixed:

- `#I-1–#I-3`: the web image now ships nginx SPA routing plus runtime API URL injection, and compose now runs `prisma migrate deploy` through a dedicated `migrate` service before the API starts.
- `#I-4–#I-8`: compose now adds `host.docker.internal:host-gateway`, restarts `api` and `web`, removes the duplicate API healthcheck, and parameterizes the API port binding instead of hardcoding `4000:4000`.
- `#I-10–#I-12`: dev override installs use `--frozen-lockfile`, the Docker env example now labels the HTTP Google callback as local-only, and Docker defaults are aligned around port `3000`.
- `#I-6` and `#I-13`: the API image now installs OpenSSL in a shared base stage, injects a build-only `DATABASE_URL` before `prisma generate`, keeps `pnpm deploy --legacy` because the current workspace layout still requires it, the local compose migrate step now recovers the known failed refresh-token uniqueness migration before applying the repaired dedupe SQL, and local compose explicitly forces development-mode callback/API port settings so untracked `.env.docker` drift cannot break startup.

Closed as non-defect:

- `#I-9`: the dev web override still binds Vite to port `80`, but that container runs as root in the current compose target, so the low-port bind is valid in this setup.

Outcomes:

- Production web containers can now refresh deep client routes without nginx 404s.
- One web image can be retargeted to a different API origin at startup instead of rebuild time.
- Compose startup order is safer for schema changes and Linux-host ML connectivity.

Validation:

- `docker compose -f infra/docker/docker-compose.yml -f infra/docker/docker-compose.override.yml config`
- `pnpm docker:up`
- `pnpm --filter @irontrack/web test`
- `pnpm --filter @irontrack/web typecheck`
