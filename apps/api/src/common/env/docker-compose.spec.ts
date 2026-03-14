import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

describe('Docker compose migration contracts', () => {
  it('recovers the known refresh-token migration failure before deploy in local compose', () => {
    const composeFile = readFileSync(
      resolve(__dirname, '../../../../../infra/docker/docker-compose.yml'),
      'utf8',
    );

    expect(composeFile).toContain(
      'prisma migrate resolve --rolled-back 202603050003_refresh_token_hash_unique || true',
    );
    expect(composeFile).toContain(
      'pnpm --filter @irontrack/api exec prisma migrate deploy',
    );
  });

  it('forces development-mode API runtime settings for the local docker stack', () => {
    const composeFile = readFileSync(
      resolve(__dirname, '../../../../../infra/docker/docker-compose.yml'),
      'utf8',
    );

    expect(composeFile).toContain('NODE_ENV: development');
    expect(composeFile).toContain('API_PORT: ${API_PORT:-3000}');
    expect(composeFile).toContain(
      'GOOGLE_CALLBACK_URL: http://localhost:${API_PORT:-3000}/${API_PREFIX:-api/v1}/auth/google/callback',
    );
  });

  it('allows the docker-served web origin through local api CORS', () => {
    const composeFile = readFileSync(
      resolve(__dirname, '../../../../../infra/docker/docker-compose.yml'),
      'utf8',
    );

    expect(composeFile).toContain(
      'CORS_ORIGINS: http://localhost:${WEB_PORT:-3001},http://127.0.0.1:${WEB_PORT:-3001},http://localhost:5173,http://localhost:8081',
    );
  });
});
