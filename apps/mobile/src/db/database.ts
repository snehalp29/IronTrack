import * as SQLite from 'expo-sqlite';

import { SQLITE_SCHEMA } from './schema';

const db = SQLite.openDatabaseSync('irontrack.db');

export function initDatabase() {
  db.execSync(SQLITE_SCHEMA.pendingSessions);
  db.execSync(SQLITE_SCHEMA.pendingSets);
  db.execSync(SQLITE_SCHEMA.syncQueue);
}

export function getDatabase() {
  return db;
}
