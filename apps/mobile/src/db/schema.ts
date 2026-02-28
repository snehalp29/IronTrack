export const SQLITE_SCHEMA = {
  pendingSessions: `
    CREATE TABLE IF NOT EXISTS pending_sessions (
      local_id TEXT PRIMARY KEY,
      payload TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'PENDING',
      created_at TEXT NOT NULL,
      server_id TEXT
    );
  `,
  pendingSets: `
    CREATE TABLE IF NOT EXISTS pending_sets (
      local_id TEXT PRIMARY KEY,
      session_local_id TEXT,
      payload TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'PENDING',
      created_at TEXT NOT NULL,
      server_id TEXT,
      FOREIGN KEY(session_local_id) REFERENCES pending_sessions(local_id)
    );
  `,
  syncQueue: `
    CREATE TABLE IF NOT EXISTS sync_queue (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      entity_type TEXT NOT NULL,
      local_id TEXT NOT NULL,
      operation TEXT NOT NULL,
      payload TEXT NOT NULL,
      attempts INTEGER NOT NULL DEFAULT 0,
      next_attempt_at TEXT,
      created_at TEXT NOT NULL
    );
  `,
};
