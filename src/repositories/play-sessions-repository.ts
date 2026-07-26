import type { PlaySession } from '@/domain/models';
import type { PlaySessionRow } from '@/database/rows';
import type { DatabaseConnection } from '@/database/types';
import type { ChildToy } from './toys-repository';

const now = (): string => new Date().toISOString();
const toSession = (row: PlaySessionRow): PlaySession => ({ id: row.id, toyId: row.toy_id, status: row.status, startedAt: row.started_at, completedAt: row.completed_at, cleanupStartedAt: row.cleanup_started_at, helpRequested: row.help_requested === 1, parentOverrideUsed: row.parent_override_used === 1, createdAt: row.created_at, updatedAt: row.updated_at });

export type ActivePlaySession = PlaySession & { toy: ChildToy | null };

type ActiveSessionRow = PlaySessionRow & {
  room_name: string | null;
  storage_spot_name: string | null;
  name: string | null;
  image_uri: string | null;
  room_id: number | null;
  storage_spot_id: number | null;
  cleanup_difficulty: 'easy' | 'medium' | 'big' | null;
  adult_help_required: number | null;
  is_available: number | null;
  is_archived: number | null;
};

export async function createPlaySession(database: DatabaseConnection, toyId: number): Promise<PlaySession> {
  const timestamp = now();
  const result = await database.runAsync('INSERT INTO play_sessions (toy_id, status, started_at, completed_at, cleanup_started_at, help_requested, parent_override_used, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?);', toyId, 'active', timestamp, null, null, 0, 0, timestamp, timestamp);
  const session = await getPlaySession(database, result.lastInsertRowId);
  if (!session) throw new Error('Created play session could not be loaded.');
  return session;
}

export async function getPlaySession(database: DatabaseConnection, id: number): Promise<PlaySession | null> {
  const row = await database.getFirstAsync<PlaySessionRow>('SELECT id, toy_id, status, started_at, completed_at, cleanup_started_at, help_requested, parent_override_used, created_at, updated_at FROM play_sessions WHERE id = ?;', id);
  return row ? toSession(row) : null;
}

export async function getActivePlaySession(database: DatabaseConnection): Promise<ActivePlaySession | null> {
  const row = await database.getFirstAsync<ActiveSessionRow>(
    `SELECT p.id, p.toy_id, p.status, p.started_at, p.completed_at, p.cleanup_started_at, p.help_requested, p.parent_override_used, p.created_at, p.updated_at,
            t.name, t.image_uri, t.room_id, t.storage_spot_id, t.cleanup_difficulty, t.adult_help_required, t.is_available, t.is_archived,
            r.name AS room_name, s.name AS storage_spot_name
       FROM play_sessions p
       LEFT JOIN toys t ON t.id = p.toy_id
       LEFT JOIN rooms r ON r.id = t.room_id
       LEFT JOIN storage_spots s ON s.id = t.storage_spot_id AND s.room_id = t.room_id
      WHERE p.status = ? ORDER BY p.id DESC LIMIT 1;`, 'active',
  );
  if (!row) return null;
  const toy = typeof row.name === 'string' && typeof row.room_name === 'string' && typeof row.storage_spot_name === 'string' && typeof row.room_id === 'number' && typeof row.storage_spot_id === 'number'
    ? { id: row.toy_id, name: row.name, imageUri: row.image_uri, roomId: row.room_id, storageSpotId: row.storage_spot_id, cleanupDifficulty: row.cleanup_difficulty ?? 'easy', adultHelpRequired: row.adult_help_required === 1, isAvailable: row.is_available === 1, isArchived: row.is_archived === 1, categories: [], createdAt: row.created_at, updatedAt: row.updated_at, roomName: row.room_name, storageSpotName: row.storage_spot_name }
    : null;
  return { ...toSession(row), toy };
}

export async function startPlaySessionIfNoneActive(database: DatabaseConnection, toyId: number): Promise<ActivePlaySession> {
  let session: ActivePlaySession | null = null;
  await database.withTransactionAsync(async () => {
    session = await getActivePlaySession(database);
    if (session) return;
    await createPlaySession(database, toyId);
    session = await getActivePlaySession(database);
  });
  if (!session) throw new Error('Play session could not be started.');
  return session;
}

export async function completePlaySession(database: DatabaseConnection, id: number): Promise<PlaySession> {
  const timestamp = now();
  const result = await database.runAsync('UPDATE play_sessions SET status = ?, completed_at = ?, updated_at = ? WHERE id = ? AND status = ?;', 'completed', timestamp, timestamp, id, 'active');
  if (result.changes !== 1) throw new Error('Active play session could not be completed.');
  const session = await getPlaySession(database, id);
  if (!session) throw new Error('Completed play session could not be loaded.');
  return session;
}

export async function markCleanupStarted(database: DatabaseConnection, id: number): Promise<PlaySession> {
  const timestamp = now();
  const result = await database.runAsync('UPDATE play_sessions SET cleanup_started_at = COALESCE(cleanup_started_at, ?), updated_at = ? WHERE id = ? AND status = ?;', timestamp, timestamp, id, 'active');
  if (result.changes !== 1) throw new Error('Cleanup could not be started.');
  const session = await getPlaySession(database, id);
  if (!session) throw new Error('Cleanup session could not be loaded.');
  return session;
}

export async function markCleanupHelpRequested(database: DatabaseConnection, id: number): Promise<PlaySession> {
  const timestamp = now();
  const result = await database.runAsync('UPDATE play_sessions SET help_requested = ?, updated_at = ? WHERE id = ? AND status = ?;', 1, timestamp, id, 'active');
  if (result.changes !== 1) throw new Error('Cleanup help could not be requested.');
  const session = await getPlaySession(database, id);
  if (!session) throw new Error('Cleanup session could not be loaded.');
  return session;
}

export async function completePlaySessionWithParentOverride(database: DatabaseConnection, id: number): Promise<PlaySession> {
  const timestamp = now();
  const result = await database.runAsync('UPDATE play_sessions SET status = ?, completed_at = ?, parent_override_used = ?, updated_at = ? WHERE id = ? AND status = ?;', 'completed', timestamp, 1, timestamp, id, 'active');
  if (result.changes !== 1) throw new Error('Active play session could not be completed.');
  const session = await getPlaySession(database, id);
  if (!session) throw new Error('Completed play session could not be loaded.');
  return session;
}
