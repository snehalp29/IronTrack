import { HealthController } from './health.controller';

describe('HealthController', () => {
  it('returns ok health payload with ISO timestamp', () => {
    const controller = new HealthController();

    const result = controller.health();

    expect(result.status).toBe('ok');
    expect(new Date(result.timestamp).toISOString()).toBe(result.timestamp);
  });
});
