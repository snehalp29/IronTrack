import { describe, expect, it } from 'vitest';

import config from './vitest.config';

describe('vitest coverage config', () => {
  it('enforces global thresholds for statements, branches, functions, and lines', () => {
    const thresholds = config.test?.coverage?.thresholds;

    expect(thresholds).toEqual({
      statements: 100,
      branches: 100,
      functions: 100,
      lines: 100,
    });
  });
});
