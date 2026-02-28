import { getDatabase } from './database';

interface SyncResult {
  synced: number;
  conflicts: number;
}

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
  const items = db.getAllSync<{
    id: number;
    entity_type: string;
    local_id: string;
    payload: string;
  }>(`SELECT * FROM sync_queue ORDER BY id ASC`);

  let synced = 0;
  let conflicts = 0;

  for (const item of items) {
    try {
      const payload = JSON.parse(item.payload);
      await fakeRemoteApply(item.entity_type, payload);

      db.runSync(`DELETE FROM sync_queue WHERE id = ?`, [item.id]);
      synced += 1;
    } catch (error) {
      const message = (error as Error).message;
      if (message.includes('409')) {
        // Conflict strategy:
        // - server-wins ordering metadata
        // - client-wins set payload details
        conflicts += 1;
      }

      db.runSync(
        `UPDATE sync_queue SET attempts = attempts + 1, next_attempt_at = ? WHERE id = ?`,
        [new Date(Date.now() + 30_000).toISOString(), item.id],
      );
    }
  }

  return { synced, conflicts };
}

async function fakeRemoteApply(
  _entityType: string,
  _payload: unknown,
): Promise<void> {
  return;
}
