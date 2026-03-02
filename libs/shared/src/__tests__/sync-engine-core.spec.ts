import { describe, expect, it, vi } from 'vitest';

import {
  DUE_SYNC_QUEUE_QUERY,
  type SyncQueueDb,
  replaySyncQueueWithDb,
} from '../../../../apps/mobile/src/db/syncEngine.core';

describe('sync engine core', () => {
  it('queries only due queue items using next_attempt_at cutoff', async () => {
    const db: SyncQueueDb = {
      getAllSync: vi.fn().mockReturnValue([]),
      runSync: vi.fn(),
    };

    const now = new Date('2026-03-02T10:00:00.000Z');
    await replaySyncQueueWithDb(db, vi.fn(), now);

    expect(db.getAllSync).toHaveBeenCalledWith(DUE_SYNC_QUEUE_QUERY, [
      '2026-03-02T10:00:00.000Z',
    ]);
  });

  it('increments attempts and schedules next attempt 30s later on failure', async () => {
    const db: SyncQueueDb = {
      getAllSync: vi.fn().mockReturnValue([
        {
          id: 7,
          entity_type: 'session',
          local_id: 'local-7',
          payload: '{',
        },
      ]),
      runSync: vi.fn(),
    };

    const now = new Date('2026-03-02T10:00:00.000Z');
    await replaySyncQueueWithDb(db, vi.fn(), now);

    expect(db.runSync).toHaveBeenCalledWith(
      'UPDATE sync_queue SET attempts = attempts + 1, next_attempt_at = ? WHERE id = ?',
      ['2026-03-02T10:00:30.000Z', 7],
    );
  });
});
