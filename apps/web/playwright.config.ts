import { defineConfig, devices } from '@playwright/test';

const runHeadless =
  process.env.CI === 'true' || process.env.PW_HEADLESS === '1';

export default defineConfig({
  testDir: './e2e',
  outputDir: '../../output/playwright',
  fullyParallel: true,
  timeout: 30_000,
  expect: {
    timeout: 5_000,
  },
  use: {
    baseURL: 'http://127.0.0.1:4173',
    headless: runHeadless,
    launchOptions: runHeadless ? undefined : { slowMo: 120 },
    trace: 'on-first-retry',
  },
  webServer: {
    command: 'pnpm --filter @irontrack/web dev --host 127.0.0.1 --port 4173',
    url: 'http://127.0.0.1:4173/login',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
