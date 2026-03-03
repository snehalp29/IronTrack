import {
  type SyncOperation,
  type SyncQueueDb,
  type SyncQueueMutation,
  type SyncResult,
  replaySyncQueueWithDb,
} from '@irontrack/shared';

import { getDatabase } from './database';

export async function queueMutation(
  entityType: string,
  localId: string,
  operation: SyncOperation,
  payload: unknown,
) {
  const db = getDatabase();
  db.runSync(
    `INSERT INTO sync_queue (entity_type, local_id, operation, payload, created_at) VALUES (?, ?, ?, ?, ?)`,
    [
      entityType,
      localId,
      operation,
      JSON.stringify(payload),
      new Date().toISOString(),
    ],
  );
}

export async function replaySyncQueue(): Promise<SyncResult> {
  const db = getDatabase();
  return replaySyncQueueWithDb(asSyncQueueDb(db), fakeRemoteApply);
}

async function fakeRemoteApply(_mutation: SyncQueueMutation): Promise<void> {
  return;
}

function asSyncQueueDb(db: ReturnType<typeof getDatabase>): SyncQueueDb {
  return {
    getAllSync<T>(query: string, params?: unknown[]): T[] {
      return db.getAllSync<T>(query, (params ?? []) as never);
    },
    runSync(query: string, params?: unknown[]): void {
      db.runSync(query, (params ?? []) as never);
    },
  };
}
