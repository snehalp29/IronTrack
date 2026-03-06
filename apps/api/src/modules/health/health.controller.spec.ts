import { HealthController } from './health.controller';

const DEFAULT_THROTTLER_SKIP_METADATA_KEY = 'THROTTLER:SKIPdefault';

describe('HealthController', () => {
  it('returns ok health payload with ISO timestamp', () => {
    const controller = new HealthController();

    const result = controller.health();

    expect(result.status).toBe('ok');
    expect(new Date(result.timestamp).toISOString()).toBe(result.timestamp);
  });

  it('skips the default throttler for health probes', () => {
    expect(
      Reflect.getMetadata(
        DEFAULT_THROTTLER_SKIP_METADATA_KEY,
        HealthController,
      ),
    ).toBe(true);
  });
});
