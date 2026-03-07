import { defineConfig, devices } from '@playwright/test';

const WEB_E2E_HOST = '127.0.0.1';
const WEB_E2E_PORT = 4173;
const WEB_E2E_BASE_URL = `http://${WEB_E2E_HOST}:${WEB_E2E_PORT}`;

export function createPlaywrightConfig(env: NodeJS.ProcessEnv = process.env) {
  const isCi = env.CI === 'true';
  const runHeadless = isCi || env.PW_HEADLESS === '1';
  const webServerCommand = isCi
    ? `pnpm --filter @irontrack/web preview --host ${WEB_E2E_HOST} --port ${WEB_E2E_PORT} --strictPort`
    : `pnpm --filter @irontrack/web dev --host ${WEB_E2E_HOST} --port ${WEB_E2E_PORT}`;

  return defineConfig({
    testDir: './e2e',
    outputDir: '../../output/playwright',
    fullyParallel: true,
    timeout: 30_000,
    expect: {
      timeout: 5_000,
    },
    use: {
      baseURL: WEB_E2E_BASE_URL,
      headless: runHeadless,
      launchOptions: runHeadless ? undefined : { slowMo: 120 },
      trace: 'on-first-retry',
    },
    webServer: {
      command: webServerCommand,
      url: WEB_E2E_BASE_URL,
      reuseExistingServer: false,
      timeout: 120_000,
    },
    projects: [
      {
        name: 'chromium',
        use: { ...devices['Desktop Chrome'] },
      },
    ],
  });
}

export default createPlaywrightConfig();
