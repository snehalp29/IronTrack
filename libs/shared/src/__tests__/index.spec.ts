import { describe, expect, it } from 'vitest';

import * as shared from '../index';

describe('shared root index', () => {
  it('re-exports runtime utilities, enums, constants, and schemas', () => {
    expect(shared.API_PREFIX).toBe('api/v1');
    expect(shared.UnitPreference.IMPERIAL).toBe('IMPERIAL');
    expect(shared.calculateSetVolume).toBeTypeOf('function');
    expect(shared.estimateOneRm).toBeTypeOf('function');
    expect(shared.emailSchema.safeParse('coach@irontrack.app').success).toBe(
      true,
    );
  });
});
