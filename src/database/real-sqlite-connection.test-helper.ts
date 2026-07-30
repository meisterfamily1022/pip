import { DatabaseSync } from 'node:sqlite';

import type { DatabaseConnection, SqlParameters, SqlRunResult } from './types';

/**
 * A `DatabaseConnection` backed by Node's built-in SQLite.
 *
 * Tests use this instead of a hand-written fake so the real SQL — joins,
 * EXISTS filters, LIKE escaping, CHECK constraints and partial unique indexes —
 * is exercised exactly as `expo-sqlite` will run it on a device.
 */
export class RealSqliteConnection implements DatabaseConnection {
  private readonly database = new DatabaseSync(':memory:');

  async execAsync(source: string): Promise<void> {
    this.database.exec(source);
  }

  async runAsync(source: string, ...parameters: SqlParameters): Promise<SqlRunResult> {
    const result = this.database.prepare(source).run(...parameters);
    return { lastInsertRowId: Number(result.lastInsertRowid), changes: Number(result.changes) };
  }

  async getFirstAsync<T>(source: string, ...parameters: SqlParameters): Promise<T | null> {
    return (this.database.prepare(source).get(...parameters) as T | undefined) ?? null;
  }

  async getAllAsync<T>(source: string, ...parameters: SqlParameters): Promise<T[]> {
    return this.database.prepare(source).all(...parameters) as T[];
  }

  async withTransactionAsync(task: () => Promise<void>): Promise<void> {
    this.database.exec('BEGIN;');
    try {
      await task();
      this.database.exec('COMMIT;');
    } catch (error: unknown) {
      this.database.exec('ROLLBACK;');
      throw error;
    }
  }

  close(): void {
    this.database.close();
  }
}
