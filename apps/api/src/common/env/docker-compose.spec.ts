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
});
