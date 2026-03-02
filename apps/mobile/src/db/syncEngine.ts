import { getDatabase } from './database';
import { type SyncResult, replaySyncQueueWithDb } from './syncEngine.core';

export async function queueMutation(
  entityType: string,
  localId: string,
  operation: string,
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
  return replaySyncQueueWithDb(db, fakeRemoteApply);
}

async function fakeRemoteApply(
  _entityType: string,
  _payload: unknown,
): Promise<void> {
  return;
}
