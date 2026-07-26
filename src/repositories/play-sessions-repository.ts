import type { PlaySession } from '@/domain/models';
import type { PlaySessionRow } from '@/database/rows';
import type { DatabaseConnection } from '@/database/types';

const now = (): string => new Date().toISOString();
const toSession = (row: PlaySessionRow): PlaySession => ({ id: row.id, toyId: row.toy_id, status: row.status, startedAt: row.started_at, completedAt: row.completed_at, createdAt: row.created_at, updatedAt: row.updated_at });

export async function createPlaySession(database: DatabaseConnection, toyId: number): Promise<PlaySession> {
  const timestamp = now();
  const result = await database.runAsync('INSERT INTO play_sessions (toy_id, status, started_at, completed_at, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?);', toyId, 'active', timestamp, null, timestamp, timestamp);
  const session = await getPlaySession(database, result.lastInsertRowId);
  if (!session) throw new Error('Created play session could not be loaded.');
  return session;
}

export async function getPlaySession(database: DatabaseConnection, id: number): Promise<PlaySession | null> {
  const row = await database.getFirstAsync<PlaySessionRow>('SELECT id, toy_id, status, started_at, completed_at, created_at, updated_at FROM play_sessions WHERE id = ?;', id);
  return row ? toSession(row) : null;
}

export async function completePlaySession(database: DatabaseConnection, id: number): Promise<PlaySession> {
  const timestamp = now();
  const result = await database.runAsync('UPDATE play_sessions SET status = ?, completed_at = ?, updated_at = ? WHERE id = ? AND status = ?;', 'completed', timestamp, timestamp, id, 'active');
  if (result.changes !== 1) throw new Error('Active play session could not be completed.');
  const session = await getPlaySession(database, id);
  if (!session) throw new Error('Completed play session could not be loaded.');
  return session;
}
