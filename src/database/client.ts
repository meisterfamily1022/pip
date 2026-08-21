import * as SQLite from 'expo-sqlite';

import { runMigrations } from './migrations';
import { ensureSettings } from '@/repositories/settings-repository';
import type { DatabaseConnection } from './types';

// Rebrand compatibility: keep this legacy filename so existing Pip installs load their saved data.
const DATABASE_NAME = 'playmap-v1.db';

let initializedDatabase: DatabaseConnection | null = null;
let initializationPromise: Promise<DatabaseConnection> | null = null;
let databaseWasCreated = false;

/**
 * Whether this launch created the local database.
 *
 * True on a first install and after a reinstall, because deleting an iOS app
 * removes its files. Startup uses it to notice keychain entries left behind by
 * an installation that no longer exists.
 */
export function didCreateDatabaseThisLaunch(): boolean {
  return databaseWasCreated;
}

export async function initializeDatabase(): Promise<DatabaseConnection> {
  if (initializedDatabase) return initializedDatabase;
  if (!initializationPromise) {
    initializationPromise = SQLite.openDatabaseAsync(DATABASE_NAME)
      .then(async (database) => {
        const { createdDatabase } = await runMigrations(database);
        databaseWasCreated = createdDatabase;
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
  databaseWasCreated = false;
}
