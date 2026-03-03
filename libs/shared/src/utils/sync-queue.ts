export interface SyncResult {
  synced: number;
  conflicts: number;
}

export type SyncOperation = 'CREATE' | 'UPDATE' | 'DELETE';

export interface SyncQueueItem {
  id: number;
  entity_type: string;
  local_id: string;
  operation: SyncOperation;
  payload: string;
}

export interface SyncQueueMutation {
  entityType: string;
  localId: string;
  operation: SyncOperation;
  payload: unknown;
}

export interface SyncQueueDb {
  getAllSync<T>(query: string, params?: unknown[]): T[];
  runSync(query: string, params?: unknown[]): void;
}

export const DUE_SYNC_QUEUE_QUERY =
  'SELECT * FROM sync_queue WHERE next_attempt_at IS NULL OR next_attempt_at <= ? ORDER BY id ASC';

type StructuredSyncError = {
  status?: unknown;
  response?: {
    status?: unknown;
  };
};

function getErrorStatus(error: unknown): number | undefined {
  if (typeof error !== 'object' || error === null) {
    return undefined;
  }

  const structured = error as StructuredSyncError;
  const directStatus =
    typeof structured.status === 'number' ? structured.status : undefined;
  if (directStatus !== undefined) {
    return directStatus;
  }

  return typeof structured.response?.status === 'number'
    ? structured.response.status
    : undefined;
}

export async function replaySyncQueueWithDb(
  db: SyncQueueDb,
  applyRemote: (mutation: SyncQueueMutation) => Promise<void>,
  now: Date = new Date(),
): Promise<SyncResult> {
  const items = db.getAllSync<SyncQueueItem>(DUE_SYNC_QUEUE_QUERY, [
    now.toISOString(),
  ]);

  let synced = 0;
  let conflicts = 0;

  for (const item of items) {
    try {
      const payload = JSON.parse(item.payload);
      await applyRemote({
        entityType: item.entity_type,
        localId: item.local_id,
        operation: item.operation,
        payload,
      });

      db.runSync('DELETE FROM sync_queue WHERE id = ?', [item.id]);
      synced += 1;
    } catch (error) {
      if (getErrorStatus(error) === 409) {
        conflicts += 1;
      }

      db.runSync(
        'UPDATE sync_queue SET attempts = attempts + 1, next_attempt_at = ? WHERE id = ?',
        [new Date(now.getTime() + 30_000).toISOString(), item.id],
      );
    }
  }

  return { synced, conflicts };
}
