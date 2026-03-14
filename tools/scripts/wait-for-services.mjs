const API_BASE_URL = process.env.E2E_API_BASE_URL ?? 'http://127.0.0.1:3000';
const WEB_BASE_URL = process.env.E2E_WEB_BASE_URL ?? 'http://127.0.0.1:3001';
const WAIT_TIMEOUT_MS = Number(process.env.E2E_WAIT_TIMEOUT_MS ?? '120000');
const WAIT_INTERVAL_MS = Number(process.env.E2E_WAIT_INTERVAL_MS ?? '1000');

async function waitFor(url, description) {
  const startedAt = Date.now();
  let lastError = null;

  while (Date.now() - startedAt < WAIT_TIMEOUT_MS) {
    try {
      const response = await fetch(url, {
        redirect: 'manual',
      });

      if (response.ok || response.status === 304) {
        process.stdout.write(`[ready] ${description}: ${url}\n`);
        return;
      }

      lastError = new Error(`HTTP ${response.status}`);
    } catch (error) {
      lastError = error;
    }

    await new Promise((resolve) => setTimeout(resolve, WAIT_INTERVAL_MS));
  }

  throw new Error(
    `Timed out waiting for ${description} at ${url}: ${String(lastError)}`,
  );
}

await waitFor(new URL('/api/v1/health', API_BASE_URL).toString(), 'api');
await waitFor(WEB_BASE_URL, 'web');
