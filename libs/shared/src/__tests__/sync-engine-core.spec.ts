import { describe, expect, it, vi } from 'vitest';

import {
  DEFAULT_SYNC_BATCH_SIZE,
  DUE_SYNC_QUEUE_QUERY,
  type SyncQueueDb,
  replaySyncQueueWithDb,
} from '../utils/sync-queue';

describe('sync engine core', () => {
  function mockCryptoRandom(value: number) {
    const originalCrypto = globalThis.crypto;
    vi.stubGlobal('crypto', {
      getRandomValues: (buffer: Uint32Array) => {
        buffer[0] = value;
        return buffer;
      },
    });

    return () => {
      if (originalCrypto) {
        vi.stubGlobal('crypto', originalCrypto);
      } else {
        vi.unstubAllGlobals();
      }
    };
  }

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

    expect(result).toEqual({ synced: 3, conflicts: 0, dropped: 0 });
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
      2,
      'DELETE FROM sync_queue WHERE id = ?',
      [1],
    );
    expect(db.runSync).toHaveBeenNthCalledWith(
      4,
      'DELETE FROM sync_queue WHERE id = ?',
      [2],
    );
    expect(db.runSync).toHaveBeenNthCalledWith(
      6,
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
      .mockRejectedValueOnce({ status: 409, message: 'Conflict' })
      .mockResolvedValueOnce(undefined);

    const result = await replaySyncQueueWithDb(
      db,
      applyRemote,
      new Date('2026-03-02T10:00:00.000Z'),
    );

    expect(result).toEqual({ synced: 1, conflicts: 1, dropped: 0 });
    expect(applyRemote).toHaveBeenCalledTimes(2);
    expect(db.runSync).toHaveBeenCalledWith(
      'UPDATE sync_queue SET next_attempt_at = ? WHERE id = ? AND (next_attempt_at IS NULL OR next_attempt_at <= ?)',
      [expect.any(String), 10, '2026-03-02T10:00:00.000Z'],
    );
    expect(db.runSync).toHaveBeenCalledWith(
      'UPDATE sync_queue SET attempts = attempts + 1, next_attempt_at = ? WHERE id = ?',
      ['2026-03-02T10:00:30.000Z', 10],
    );
    expect(db.runSync).toHaveBeenCalledWith(
      'DELETE FROM sync_queue WHERE id = ?',
      [11],
    );
  });

  it('does not count conflicts from message substring matching alone', async () => {
    const db: SyncQueueDb = {
      getAllSync: vi.fn().mockReturnValue([
        {
          id: 12,
          entity_type: 'set',
          local_id: 'set-local-12',
          operation: 'UPDATE',
          payload: '{"reps":8}',
        },
      ]),
      runSync: vi.fn(),
    };
    const applyRemote = vi
      .fn()
      .mockRejectedValueOnce(new Error('remote returned 409 text'));

    const result = await replaySyncQueueWithDb(
      db,
      applyRemote,
      new Date('2026-03-02T10:00:00.000Z'),
    );

    expect(result).toEqual({ synced: 0, conflicts: 0, dropped: 0 });
  });

  it('counts conflicts when status is provided under error.response.status', async () => {
    const db: SyncQueueDb = {
      getAllSync: vi.fn().mockReturnValue([
        {
          id: 13,
          entity_type: 'set',
          local_id: 'set-local-13',
          operation: 'DELETE',
          payload: '{"setId":"13"}',
        },
      ]),
      runSync: vi.fn(),
    };
    const applyRemote = vi
      .fn()
      .mockRejectedValueOnce({ response: { status: 409 } });

    const result = await replaySyncQueueWithDb(
      db,
      applyRemote,
      new Date('2026-03-02T10:00:00.000Z'),
    );

    expect(result).toEqual({ synced: 0, conflicts: 1, dropped: 0 });
  });

  it('does not count conflicts for non-object thrown values', async () => {
    const db: SyncQueueDb = {
      getAllSync: vi.fn().mockReturnValue([
        {
          id: 14,
          entity_type: 'set',
          local_id: 'set-local-14',
          operation: 'UPDATE',
          payload: '{"reps":5}',
        },
      ]),
      runSync: vi.fn(),
    };
    const applyRemote = vi.fn().mockRejectedValueOnce('transport error');

    const result = await replaySyncQueueWithDb(
      db,
      applyRemote,
      new Date('2026-03-02T10:00:00.000Z'),
    );

    expect(result).toEqual({ synced: 0, conflicts: 0, dropped: 0 });
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
      getAllSync: vi.fn((query: string) => {
        if (query === DUE_SYNC_QUEUE_QUERY) {
          return [];
        }
        return [{ id: 1 }];
      }),
      runSync: vi.fn(),
    };

    const now = new Date('2026-03-02T10:00:00.000Z');
    await replaySyncQueueWithDb(db, vi.fn(), now);

    expect(db.getAllSync).toHaveBeenCalledWith(DUE_SYNC_QUEUE_QUERY, [
      '2026-03-02T10:00:00.000Z',
      DEFAULT_SYNC_BATCH_SIZE,
    ]);
  });

  it('increments attempts and schedules next attempt 30s later on failure', async () => {
    const restoreCrypto = mockCryptoRandom(0);
    const db: SyncQueueDb = {
      getAllSync: vi.fn().mockReturnValue([
        {
          id: 7,
          entity_type: 'session',
          local_id: 'local-7',
          operation: 'UPDATE',
          payload: '{"retry":true}',
        },
      ]),
      runSync: vi.fn(),
    };
    const applyRemote = vi.fn().mockRejectedValueOnce({ status: 500 });

    try {
      const now = new Date('2026-03-02T10:00:00.000Z');
      await replaySyncQueueWithDb(db, applyRemote, now);

      expect(db.runSync).toHaveBeenCalledWith(
        'UPDATE sync_queue SET next_attempt_at = ? WHERE id = ? AND (next_attempt_at IS NULL OR next_attempt_at <= ?)',
        ['2026-03-02T10:01:00.001Z', 7, '2026-03-02T10:00:00.000Z'],
      );
      expect(db.runSync).toHaveBeenCalledWith(
        'UPDATE sync_queue SET attempts = attempts + 1, next_attempt_at = ? WHERE id = ?',
        ['2026-03-02T10:00:30.000Z', 7],
      );
    } finally {
      restoreCrypto();
    }
  });

  it('respects custom batch size option when querying due items', async () => {
    const db: SyncQueueDb = {
      getAllSync: vi.fn((query: string) => {
        if (query === DUE_SYNC_QUEUE_QUERY) {
          return [];
        }
        return [{ id: 1 }];
      }),
      runSync: vi.fn(),
    };

    await replaySyncQueueWithDb(
      db,
      vi.fn(),
      new Date('2026-03-02T10:00:00.000Z'),
      { batchSize: 25 },
    );

    expect(db.getAllSync).toHaveBeenCalledWith(DUE_SYNC_QUEUE_QUERY, [
      '2026-03-02T10:00:00.000Z',
      25,
    ]);
  });

  it('skips applying item when claim verification indicates another runner claimed it', async () => {
    const db: SyncQueueDb = {
      getAllSync: vi.fn((query: string) => {
        if (query === DUE_SYNC_QUEUE_QUERY) {
          return [
            {
              id: 101,
              entity_type: 'session',
              local_id: 'session-local-101',
              operation: 'UPDATE',
              payload: '{"name":"Push Day"}',
            },
          ];
        }
        return [];
      }),
      runSync: vi.fn(),
    };
    const applyRemote = vi.fn().mockResolvedValue(undefined);

    const result = await replaySyncQueueWithDb(
      db,
      applyRemote,
      new Date('2026-03-02T10:00:00.000Z'),
    );

    expect(result).toEqual({ synced: 0, conflicts: 0, dropped: 0 });
    expect(applyRemote).not.toHaveBeenCalled();
    expect(db.runSync).not.toHaveBeenCalledWith(
      'DELETE FROM sync_queue WHERE id = ?',
      [101],
    );
  });

  it('uses custom claim lease and retry delay options', async () => {
    const restoreCrypto = mockCryptoRandom(0);
    const db: SyncQueueDb = {
      getAllSync: vi.fn((query: string) => {
        if (query === DUE_SYNC_QUEUE_QUERY) {
          return [
            {
              id: 5,
              entity_type: 'set',
              local_id: 'set-local-5',
              operation: 'UPDATE',
              payload: '{"reps":12}',
            },
          ];
        }
        return [{ id: 5 }];
      }),
      runSync: vi.fn(),
    };
    const applyRemote = vi.fn().mockRejectedValueOnce({ status: 500 });

    try {
      const result = await replaySyncQueueWithDb(
        db,
        applyRemote,
        new Date('2026-03-02T10:00:00.000Z'),
        { claimLeaseMs: 90_000, retryDelayMs: 45_000 },
      );

      expect(result).toEqual({ synced: 0, conflicts: 0, dropped: 0 });
      expect(db.runSync).toHaveBeenCalledWith(
        'UPDATE sync_queue SET next_attempt_at = ? WHERE id = ? AND (next_attempt_at IS NULL OR next_attempt_at <= ?)',
        ['2026-03-02T10:01:30.001Z', 5, '2026-03-02T10:00:00.000Z'],
      );
      expect(db.runSync).toHaveBeenCalledWith(
        'UPDATE sync_queue SET attempts = attempts + 1, next_attempt_at = ? WHERE id = ?',
        ['2026-03-02T10:00:45.000Z', 5],
      );
    } finally {
      restoreCrypto();
    }
  });

  it('falls back to defaults when integer options are non-positive', async () => {
    const restoreCrypto = mockCryptoRandom(0);
    const db: SyncQueueDb = {
      getAllSync: vi.fn((query: string) => {
        if (query === DUE_SYNC_QUEUE_QUERY) {
          return [
            {
              id: 6,
              entity_type: 'set',
              local_id: 'set-local-6',
              operation: 'UPDATE',
              payload: '{"reps":8}',
            },
          ];
        }
        return [{ id: 6 }];
      }),
      runSync: vi.fn(),
    };
    const applyRemote = vi.fn().mockRejectedValueOnce({ status: 500 });

    try {
      await replaySyncQueueWithDb(
        db,
        applyRemote,
        new Date('2026-03-02T10:00:00.000Z'),
        { batchSize: 0, claimLeaseMs: 0, retryDelayMs: 0 },
      );

      expect(db.getAllSync).toHaveBeenCalledWith(DUE_SYNC_QUEUE_QUERY, [
        '2026-03-02T10:00:00.000Z',
        DEFAULT_SYNC_BATCH_SIZE,
      ]);
      expect(db.runSync).toHaveBeenCalledWith(
        'UPDATE sync_queue SET next_attempt_at = ? WHERE id = ? AND (next_attempt_at IS NULL OR next_attempt_at <= ?)',
        ['2026-03-02T10:01:00.001Z', 6, '2026-03-02T10:00:00.000Z'],
      );
      expect(db.runSync).toHaveBeenCalledWith(
        'UPDATE sync_queue SET attempts = attempts + 1, next_attempt_at = ? WHERE id = ?',
        ['2026-03-02T10:00:30.000Z', 6],
      );
    } finally {
      restoreCrypto();
    }
  });

  it('drops poison-pill items once they exceed the max attempt threshold', async () => {
    const restoreCrypto = mockCryptoRandom(0);
    const consoleErrorSpy = vi
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);
    const db: SyncQueueDb = {
      getAllSync: vi.fn((query: string) => {
        if (query === DUE_SYNC_QUEUE_QUERY) {
          return [
            {
              id: 88,
              entity_type: 'session',
              local_id: 'local-88',
              operation: 'UPDATE',
              payload: '{"name":"retry-me"}',
              attempts: 9,
            },
          ];
        }
        return [{ id: 88 }];
      }),
      runSync: vi.fn(),
    };
    const applyRemote = vi.fn().mockRejectedValueOnce({ status: 500 });

    try {
      const result = await replaySyncQueueWithDb(
        db,
        applyRemote,
        new Date('2026-03-02T10:00:00.000Z'),
      );

      expect(result).toEqual({ synced: 0, conflicts: 0, dropped: 1 });
      expect(db.runSync).toHaveBeenCalledWith(
        'DELETE FROM sync_queue WHERE id = ?',
        [88],
      );
      expect(db.runSync).not.toHaveBeenCalledWith(
        'UPDATE sync_queue SET attempts = attempts + 1, next_attempt_at = ? WHERE id = ?',
        [expect.any(String), 88],
      );
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Dropping exhausted sync queue item',
        expect.objectContaining({
          entityType: 'session',
          localId: 'local-88',
          operation: 'UPDATE',
        }),
      );
    } finally {
      consoleErrorSpy.mockRestore();
      restoreCrypto();
    }
  });

  it('drops malformed JSON payloads immediately instead of retrying them', async () => {
    const consoleErrorSpy = vi
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);
    const db: SyncQueueDb = {
      getAllSync: vi.fn((query: string) => {
        if (query === DUE_SYNC_QUEUE_QUERY) {
          return [
            {
              id: 91,
              entity_type: 'session',
              local_id: 'local-91',
              operation: 'UPDATE',
              payload: '{"broken":',
              attempts: 0,
            },
          ];
        }
        return [{ id: 91 }];
      }),
      runSync: vi.fn(),
    };
    const applyRemote = vi.fn();

    try {
      const result = await replaySyncQueueWithDb(
        db,
        applyRemote,
        new Date('2026-03-02T10:00:00.000Z'),
      );

      expect(result).toEqual({ synced: 0, conflicts: 0, dropped: 1 });
      expect(applyRemote).not.toHaveBeenCalled();
      expect(db.runSync).toHaveBeenCalledWith(
        'DELETE FROM sync_queue WHERE id = ?',
        [91],
      );
      expect(db.runSync).not.toHaveBeenCalledWith(
        'UPDATE sync_queue SET attempts = attempts + 1, next_attempt_at = ? WHERE id = ?',
        [expect.any(String), 91],
      );
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Dropping malformed sync queue item payload',
        expect.objectContaining({
          entityType: 'session',
          localId: 'local-91',
          operation: 'UPDATE',
        }),
      );
    } finally {
      consoleErrorSpy.mockRestore();
    }
  });

  it('drops items when a custom maxAttempts threshold is reached', async () => {
    const restoreCrypto = mockCryptoRandom(0);
    const consoleErrorSpy = vi
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);
    const db: SyncQueueDb = {
      getAllSync: vi.fn((query: string) => {
        if (query === DUE_SYNC_QUEUE_QUERY) {
          return [
            {
              id: 92,
              entity_type: 'session',
              local_id: 'local-92',
              operation: 'UPDATE',
              payload: '{"name":"retry-me"}',
              attempts: 2,
            },
          ];
        }
        return [{ id: 92 }];
      }),
      runSync: vi.fn(),
    };
    const applyRemote = vi.fn().mockRejectedValueOnce({ status: 500 });

    try {
      const result = await replaySyncQueueWithDb(
        db,
        applyRemote,
        new Date('2026-03-02T10:00:00.000Z'),
        { maxAttempts: 3 },
      );

      expect(result).toEqual({ synced: 0, conflicts: 0, dropped: 1 });
      expect(db.runSync).toHaveBeenCalledWith(
        'DELETE FROM sync_queue WHERE id = ?',
        [92],
      );
      expect(db.runSync).not.toHaveBeenCalledWith(
        'UPDATE sync_queue SET attempts = attempts + 1, next_attempt_at = ? WHERE id = ?',
        [expect.any(String), 92],
      );
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Dropping exhausted sync queue item',
        expect.objectContaining({
          entityType: 'session',
          localId: 'local-92',
          operation: 'UPDATE',
        }),
      );
    } finally {
      consoleErrorSpy.mockRestore();
      restoreCrypto();
    }
  });

  it('counts an exhausted conflict as a drop instead of double-counting it', async () => {
    const consoleErrorSpy = vi
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);
    const db: SyncQueueDb = {
      getAllSync: vi.fn((query: string) => {
        if (query === DUE_SYNC_QUEUE_QUERY) {
          return [
            {
              id: 93,
              entity_type: 'session',
              local_id: 'local-93',
              operation: 'UPDATE',
              payload: '{"name":"conflict"}',
              attempts: 9,
            },
          ];
        }
        return [{ id: 93 }];
      }),
      runSync: vi.fn(),
    };
    const applyRemote = vi.fn().mockRejectedValueOnce({ status: 409 });

    try {
      const result = await replaySyncQueueWithDb(
        db,
        applyRemote,
        new Date('2026-03-02T10:00:00.000Z'),
      );

      expect(result).toEqual({ synced: 0, conflicts: 0, dropped: 1 });
      expect(db.runSync).toHaveBeenCalledWith(
        'DELETE FROM sync_queue WHERE id = ?',
        [93],
      );
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Dropping exhausted sync queue item',
        expect.objectContaining({
          entityType: 'session',
          localId: 'local-93',
          operation: 'UPDATE',
        }),
      );
    } finally {
      consoleErrorSpy.mockRestore();
    }
  });
});
