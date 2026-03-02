export interface SyncResult {
  synced: number;
  conflicts: number;
}

export interface SyncQueueItem {
  id: number;
  entity_type: string;
  local_id: string;
  payload: string;
}

export interface SyncQueueDb {
  getAllSync<T>(query: string, params?: unknown[]): T[];
  runSync(query: string, params?: unknown[]): void;
}

export const DUE_SYNC_QUEUE_QUERY =
  'SELECT * FROM sync_queue WHERE next_attempt_at IS NULL OR next_attempt_at <= ? ORDER BY id ASC';

export async function replaySyncQueueWithDb(
  db: SyncQueueDb,
  applyRemote: (entityType: string, payload: unknown) => Promise<void>,
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
      await applyRemote(item.entity_type, payload);

      db.runSync('DELETE FROM sync_queue WHERE id = ?', [item.id]);
      synced += 1;
    } catch (error) {
      const message = (error as Error).message;
      if (message.includes('409')) {
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
