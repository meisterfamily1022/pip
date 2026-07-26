import * as SQLite from 'expo-sqlite';

import { runMigrations } from './migrations';
import { ensureSettings } from '@/repositories/settings-repository';
import type { DatabaseConnection } from './types';

const DATABASE_NAME = 'playmap-v1.db';

let initializedDatabase: DatabaseConnection | null = null;
let initializationPromise: Promise<DatabaseConnection> | null = null;

export async function initializeDatabase(): Promise<DatabaseConnection> {
  if (initializedDatabase) return initializedDatabase;
  if (!initializationPromise) {
    initializationPromise = SQLite.openDatabaseAsync(DATABASE_NAME)
      .then(async (database) => {
        await runMigrations(database);
        await ensureSettings(database);
        initializedDatabase = database;
        return database;
      })
      .catch((error: unknown) => {
        initializationPromise = null;
        throw error;
      });
  }
  return initializationPromise;
}

export function resetDatabaseInitializationForTests(): void {
  initializedDatabase = null;
  initializationPromise = null;
}
