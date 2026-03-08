import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

describe('Docker e2e entrypoints', () => {
  const rootPackage = JSON.parse(
    readFileSync(resolve(__dirname, '../../../../../package.json'), 'utf8'),
  ) as {
    scripts: Record<string, string>;
  };
  const apiPackage = JSON.parse(
    readFileSync(resolve(__dirname, '../../../package.json'), 'utf8'),
  ) as {
    scripts: Record<string, string>;
  };

  it('defines root scripts for docker-backed API and web e2e runs', () => {
    expect(rootPackage.scripts['docker:wait']).toBe(
      'node ./tools/scripts/wait-for-services.mjs',
    );
    expect(rootPackage.scripts['test:e2e:api:docker']).toBe(
      'pnpm --filter @irontrack/api test:e2e:docker',
    );
    expect(rootPackage.scripts['test:e2e:web:docker']).toBe(
      'E2E_TARGET=docker pnpm --filter @irontrack/web test:e2e',
    );
    expect(rootPackage.scripts['test:e2e:docker']).toBe(
      'pnpm docker:up && pnpm docker:wait && pnpm run test:e2e:api:docker && pnpm run test:e2e:web:docker',
    );
  });

  it('defines a dedicated docker e2e config for the api package', () => {
    expect(apiPackage.scripts['test:e2e:docker']).toBe(
      'jest --config ./test/jest-docker-e2e.json',
    );

    const dockerJestConfigPath = resolve(
      __dirname,
      '../../../test/jest-docker-e2e.json',
    );
    expect(existsSync(dockerJestConfigPath)).toBe(true);

    const dockerJestConfig = JSON.parse(
      readFileSync(dockerJestConfigPath, 'utf8'),
    ) as { testRegex: string };

    expect(dockerJestConfig.testRegex).toBe('.docker-e2e-spec.ts$');

    const localJestConfig = JSON.parse(
      readFileSync(resolve(__dirname, '../../../test/jest-e2e.json'), 'utf8'),
    ) as { testPathIgnorePatterns: string[] };

    expect(localJestConfig.testPathIgnorePatterns).toContain(
      '.docker-e2e-spec.ts$',
    );
  });

  it('ships the helper scripts and black-box suites needed for docker e2e', () => {
    expect(
      existsSync(
        resolve(
          __dirname,
          '../../../../../tools/scripts/wait-for-services.mjs',
        ),
      ),
    ).toBe(true);
    expect(
      existsSync(
        resolve(__dirname, '../../../test/docker-stack.docker-e2e-spec.ts'),
      ),
    ).toBe(true);
    expect(
      existsSync(
        resolve(__dirname, '../../../../../apps/web/e2e/docker-stack.spec.ts'),
      ),
    ).toBe(true);
  });
});
