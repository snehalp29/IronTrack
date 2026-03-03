import { describe, expect, it, vi } from 'vitest';

import {
  DUE_SYNC_QUEUE_QUERY,
  type SyncQueueDb,
  replaySyncQueueWithDb,
} from '../utils/sync-queue';

describe('sync engine core', () => {
  it('replays create/update/delete in order and reports all as synced', async () => {
    const db: SyncQueueDb = {
      getAllSync: vi.fn().mockReturnValue([
        {
          id: 1,
          entity_type: 'session',
          local_id: 'session-local-1',
          operation: 'CREATE',
          payload: '{"name":"Push Day"}',
        },
        {
          id: 2,
          entity_type: 'session',
          local_id: 'session-local-1',
          operation: 'UPDATE',
          payload: '{"name":"Push Day A"}',
        },
        {
          id: 3,
          entity_type: 'session',
          local_id: 'session-local-1',
          operation: 'DELETE',
          payload: '{"reason":"user_removed"}',
        },
      ]),
      runSync: vi.fn(),
    };
    const applyRemote = vi.fn().mockResolvedValue(undefined);

    const result = await replaySyncQueueWithDb(
      db,
      applyRemote,
      new Date('2026-03-02T10:00:00.000Z'),
    );

    expect(result).toEqual({ synced: 3, conflicts: 0 });
    expect(applyRemote).toHaveBeenNthCalledWith(1, {
      entityType: 'session',
      localId: 'session-local-1',
      operation: 'CREATE',
      payload: { name: 'Push Day' },
    });
    expect(applyRemote).toHaveBeenNthCalledWith(2, {
      entityType: 'session',
      localId: 'session-local-1',
      operation: 'UPDATE',
      payload: { name: 'Push Day A' },
    });
    expect(applyRemote).toHaveBeenNthCalledWith(3, {
      entityType: 'session',
      localId: 'session-local-1',
      operation: 'DELETE',
      payload: { reason: 'user_removed' },
    });

    expect(db.runSync).toHaveBeenNthCalledWith(
      1,
      'DELETE FROM sync_queue WHERE id = ?',
      [1],
    );
    expect(db.runSync).toHaveBeenNthCalledWith(
      2,
      'DELETE FROM sync_queue WHERE id = ?',
      [2],
    );
    expect(db.runSync).toHaveBeenNthCalledWith(
      3,
      'DELETE FROM sync_queue WHERE id = ?',
      [3],
    );
  });

  it('keeps processing later items when one replay hits a conflict', async () => {
    const db: SyncQueueDb = {
      getAllSync: vi.fn().mockReturnValue([
        {
          id: 10,
          entity_type: 'set',
          local_id: 'set-local-10',
          operation: 'UPDATE',
          payload: '{"reps":10}',
        },
        {
          id: 11,
          entity_type: 'set',
          local_id: 'set-local-11',
          operation: 'DELETE',
          payload: '{"setId":"11"}',
        },
      ]),
      runSync: vi.fn(),
    };
    const applyRemote = vi
      .fn()
      .mockRejectedValueOnce(new Error('409 Conflict'))
      .mockResolvedValueOnce(undefined);

    const result = await replaySyncQueueWithDb(
      db,
      applyRemote,
      new Date('2026-03-02T10:00:00.000Z'),
    );

    expect(result).toEqual({ synced: 1, conflicts: 1 });
    expect(applyRemote).toHaveBeenCalledTimes(2);
    expect(db.runSync).toHaveBeenCalledWith(
      'UPDATE sync_queue SET attempts = attempts + 1, next_attempt_at = ? WHERE id = ?',
      ['2026-03-02T10:00:30.000Z', 10],
    );
    expect(db.runSync).toHaveBeenCalledWith(
      'DELETE FROM sync_queue WHERE id = ?',
      [11],
    );
  });

  it('passes operation and local id to remote applier when replaying', async () => {
    const db: SyncQueueDb = {
      getAllSync: vi.fn().mockReturnValue([
        {
          id: 3,
          entity_type: 'session',
          local_id: 'local-3',
          operation: 'DELETE',
          payload: '{"sessionId":"s-3"}',
        },
      ]),
      runSync: vi.fn(),
    };
    const applyRemote = vi.fn().mockResolvedValue(undefined);

    await replaySyncQueueWithDb(
      db,
      applyRemote,
      new Date('2026-03-02T10:00:00.000Z'),
    );

    expect(applyRemote).toHaveBeenCalledWith({
      entityType: 'session',
      localId: 'local-3',
      operation: 'DELETE',
      payload: { sessionId: 's-3' },
    });
  });

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
          operation: 'UPDATE',
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
