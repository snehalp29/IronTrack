import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

describe('Docker build contracts', () => {
  it('installs openssl in the shared api image base so Prisma can detect the platform correctly', () => {
    const dockerfile = readFileSync(
      resolve(__dirname, '../../../../../infra/docker/Dockerfile.api'),
      'utf8',
    );

    expect(dockerfile).toContain(
      'RUN apt-get update -y && apt-get install -y --no-install-recommends openssl',
    );
    expect(dockerfile).toContain('FROM base AS build');
    expect(dockerfile).toContain('FROM base AS runtime');
  });

  it('provides a build-time DATABASE_URL before prisma generate runs in the api image', () => {
    const dockerfile = readFileSync(
      resolve(__dirname, '../../../../../infra/docker/Dockerfile.api'),
      'utf8',
    );

    const buildTimeDatabaseUrl = dockerfile.indexOf('ARG BUILD_DATABASE_URL=');
    const exportedDatabaseUrl = dockerfile.indexOf(
      'ENV DATABASE_URL=${BUILD_DATABASE_URL}',
    );
    const prismaGenerate = dockerfile.indexOf(
      'RUN corepack enable && pnpm --filter @irontrack/api prisma:generate',
    );

    expect(buildTimeDatabaseUrl).toBeGreaterThan(-1);
    expect(exportedDatabaseUrl).toBeGreaterThan(buildTimeDatabaseUrl);
    expect(prismaGenerate).toBeGreaterThan(exportedDatabaseUrl);
  });

  it('uses the legacy pnpm deploy mode required by the current workspace layout', () => {
    const dockerfile = readFileSync(
      resolve(__dirname, '../../../../../infra/docker/Dockerfile.api'),
      'utf8',
    );

    expect(dockerfile).toContain(
      'RUN pnpm --filter @irontrack/api deploy --prod --legacy /prod/api',
    );
  });
});
