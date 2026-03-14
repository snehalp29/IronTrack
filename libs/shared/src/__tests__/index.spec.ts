import { describe, expect, it } from 'vitest';

import * as shared from '../index';

describe('shared root index', () => {
  it('re-exports runtime utilities, enums, constants, sync queue helpers, and schemas', () => {
    expect(shared.API_PREFIX).toBe('api/v1');
    expect(shared.DEFAULT_PAGE_SIZE).toBe(20);
    expect(shared.CHECKLIST_ITEMS_PER_DAY).toBe(4);
    expect(shared.UnitPreference.IMPERIAL).toBe('IMPERIAL');
    expect(shared.calculateSetVolume).toBeTypeOf('function');
    expect(shared.estimateOneRm).toBeTypeOf('function');
    expect(shared.replaySyncQueueWithDb).toBeTypeOf('function');
    expect(shared.DUE_SYNC_QUEUE_QUERY).toContain('sync_queue');
    expect(shared.emailSchema.safeParse('coach@irontrack.app').success).toBe(
      true,
    );
  });
});
