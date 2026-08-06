import { DatabaseSync } from "node:sqlite";

import type { DatabaseConnection, SqlParameters, SqlRunResult } from "./types";

/**
 * A `DatabaseConnection` backed by Node's built-in SQLite.
 *
 * The `SchemaDatabase` fake in `migrations.test.ts` matches SQL as strings, so
 * it proves a statement was issued but not that it does anything. Migration
 * work needs the opposite guarantee: that constraints actually reject bad
 * writes and that backfills actually move data. These tests run the real
 * migration SQL through a real engine, the same way `expo-sqlite` will on a
 * device.
 */
export class RealSqliteConnection implements DatabaseConnection {
  private readonly database = new DatabaseSync(":memory:");

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
    this.database.exec("BEGIN;");
    try {
      await task();
      this.database.exec("COMMIT;");
    } catch (error: unknown) {
      this.database.exec("ROLLBACK;");
      throw error;
    }
  }

  close(): void {
    this.database.close();
  }
}
