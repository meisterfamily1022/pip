export type SqlParameters = readonly (string | number | null)[];

export type SqlRunResult = {
  lastInsertRowId: number;
  changes: number;
};

export interface DatabaseConnection {
  execAsync(source: string): Promise<void>;
  runAsync(source: string, ...parameters: SqlParameters): Promise<SqlRunResult>;
  getFirstAsync<T>(source: string, ...parameters: SqlParameters): Promise<T | null>;
  getAllAsync<T>(source: string, ...parameters: SqlParameters): Promise<T[]>;
  withTransactionAsync(task: () => Promise<void>): Promise<void>;
}
