import { describe, expect, it } from 'vitest';

import { createPlaywrightConfig } from './playwright.config';

describe('createPlaywrightConfig', () => {
  it('uses a base URL health target instead of a route-specific path', () => {
    const config = createPlaywrightConfig({});
    const baseURL = config.use?.baseURL;
    const webServer = config.webServer;

    expect(typeof baseURL).toBe('string');
    expect(Array.isArray(webServer)).toBe(false);
    expect((webServer as { url: string }).url).toBe(baseURL);
  });

  it('always starts an isolated web server for the test run', () => {
    const localConfig = createPlaywrightConfig({ CI: 'false' });
    const ciConfig = createPlaywrightConfig({ CI: 'true' });

    expect(
      (localConfig.webServer as { reuseExistingServer: boolean })
        .reuseExistingServer,
    ).toBe(false);
    expect(
      (ciConfig.webServer as { reuseExistingServer: boolean })
        .reuseExistingServer,
    ).toBe(false);
  });

  it('uses vite dev locally and vite preview in CI', () => {
    const localConfig = createPlaywrightConfig({ CI: 'false' });
    const ciConfig = createPlaywrightConfig({ CI: 'true' });

    expect((localConfig.webServer as { command: string }).command).toContain(
      ' dev ',
    );
    expect((ciConfig.webServer as { command: string }).command).toContain(
      ' preview ',
    );
  });
});
