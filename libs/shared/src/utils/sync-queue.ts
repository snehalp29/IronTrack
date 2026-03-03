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
  runSync(query: string, params?: unknown[]): unknown;
}

export const DEFAULT_SYNC_BATCH_SIZE = 100;
export const DEFAULT_SYNC_RETRY_DELAY_MS = 30_000;
export const DEFAULT_SYNC_CLAIM_LEASE_MS = 60_000;

export const DUE_SYNC_QUEUE_QUERY =
  'SELECT * FROM sync_queue WHERE next_attempt_at IS NULL OR next_attempt_at <= ? ORDER BY id ASC LIMIT ?';

const CLAIM_SYNC_QUEUE_ITEM_QUERY =
  'UPDATE sync_queue SET next_attempt_at = ? WHERE id = ? AND (next_attempt_at IS NULL OR next_attempt_at <= ?)';
const VERIFY_SYNC_QUEUE_ITEM_CLAIM_QUERY =
  'SELECT id FROM sync_queue WHERE id = ? AND next_attempt_at = ?';

type ReplaySyncQueueOptions = {
  batchSize?: number;
  claimLeaseMs?: number;
  retryDelayMs?: number;
};

function resolvePositiveInteger(
  value: number | undefined,
  fallback: number,
): number {
  if (typeof value === 'number' && Number.isInteger(value) && value > 0) {
    return value;
  }

  return fallback;
}

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
  options?: ReplaySyncQueueOptions,
): Promise<SyncResult> {
  const nowIso = now.toISOString();
  const batchSize = resolvePositiveInteger(
    options?.batchSize,
    DEFAULT_SYNC_BATCH_SIZE,
  );
  const claimLeaseMs = resolvePositiveInteger(
    options?.claimLeaseMs,
    DEFAULT_SYNC_CLAIM_LEASE_MS,
  );
  const retryDelayMs = resolvePositiveInteger(
    options?.retryDelayMs,
    DEFAULT_SYNC_RETRY_DELAY_MS,
  );
  const claimOffsetMs = Math.floor(Math.random() * 1000) + 1;

  const items = db.getAllSync<SyncQueueItem>(DUE_SYNC_QUEUE_QUERY, [
    nowIso,
    batchSize,
  ]);

  let synced = 0;
  let conflicts = 0;

  for (const item of items) {
    const claimUntilIso = new Date(
      now.getTime() + claimLeaseMs + claimOffsetMs,
    ).toISOString();
    db.runSync(CLAIM_SYNC_QUEUE_ITEM_QUERY, [claimUntilIso, item.id, nowIso]);

    const claimedItem = db.getAllSync<{ id: number }>(
      VERIFY_SYNC_QUEUE_ITEM_CLAIM_QUERY,
      [item.id, claimUntilIso],
    );
    if (!claimedItem.length) {
      continue;
    }

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
        [new Date(now.getTime() + retryDelayMs).toISOString(), item.id],
      );
    }
  }

  return { synced, conflicts };
}
