import type { PlaySession } from '@/domain/models';
import { getActiveHouseholdId } from '@/features/household/household-scope';
import type { PlaySessionRow } from '@/database/rows';
import type { DatabaseConnection } from '@/database/types';
import type { ChildToy } from './toys-repository';
import { selectToyImageUri } from '@/features/toys/toy-image-selection';
import { telemetry } from '@/features/analytics/telemetry-client';

const now = (): string => new Date().toISOString();
const SESSION_COLUMNS = 'p.id, p.child_id, p.toy_id, p.status, p.started_at, p.completed_at, p.cleanup_started_at, p.cleanup_step, p.help_requested, p.parent_override_used, p.created_at, p.updated_at';
const toSession = (row: PlaySessionRow): PlaySession => ({ id: row.id, childId: row.child_id, toyId: row.toy_id, status: row.status, startedAt: row.started_at, completedAt: row.completed_at, cleanupStartedAt: row.cleanup_started_at, cleanupStep: row.cleanup_step ?? 0, helpRequested: row.help_requested === 1, parentOverrideUsed: row.parent_override_used === 1, createdAt: row.created_at, updatedAt: row.updated_at });

export type ActivePlaySession = PlaySession & { childName: string; toy: ChildToy | null };

type ActiveSessionRow = PlaySessionRow & {
  child_name: string;
  room_name: string | null; storage_spot_name: string | null; name: string | null;
  image_uri: string | null; original_image_uri: string | null; enhanced_image_uri: string | null;
  preferred_image_variant: 'original' | 'enhanced'; room_id: number | null; storage_spot_id: number | null;
  cleanup_difficulty: 'easy' | 'medium' | 'big' | null; adult_help_required: number | null;
  is_available: number | null; is_archived: number | null;
};

function mapActive(row: ActiveSessionRow): ActivePlaySession {
  const toy = typeof row.name === 'string' && typeof row.room_name === 'string' && typeof row.storage_spot_name === 'string' && typeof row.room_id === 'number' && typeof row.storage_spot_id === 'number'
    ? { id: row.toy_id, name: row.name, imageUri: selectToyImageUri({ originalImageUri: row.original_image_uri, enhancedImageUri: row.enhanced_image_uri, preferredImageVariant: row.preferred_image_variant, imageUri: row.image_uri }), originalImageUri: row.original_image_uri ?? row.image_uri, enhancedImageUri: row.enhanced_image_uri, preferredImageVariant: row.preferred_image_variant ?? 'original', aiMetadataStatus: 'manual' as const, aiAnalysisId: null, aiSchemaVersion: null, aiConsentAt: null, aiConfirmedAt: null, roomId: row.room_id, storageSpotId: row.storage_spot_id, cleanupDifficulty: row.cleanup_difficulty ?? 'easy', adultHelpRequired: row.adult_help_required === 1, isAvailable: row.is_available === 1, isArchived: row.is_archived === 1, categories: [], createdAt: row.created_at, updatedAt: row.updated_at, imageRemotePath: null, roomName: row.room_name, storageSpotName: row.storage_spot_name }
    : null;
  return { ...toSession(row), childName: row.child_name, toy };
}

const ACTIVE_JOIN = `SELECT ${SESSION_COLUMNS}, c.name AS child_name,
 t.name, t.image_uri, t.original_image_uri, t.enhanced_image_uri, t.preferred_image_variant, t.room_id, t.storage_spot_id, t.cleanup_difficulty, t.adult_help_required, t.is_available, t.is_archived,
 r.name AS room_name, s.name AS storage_spot_name
 FROM play_sessions p JOIN child_profiles c ON c.id = p.child_id
 LEFT JOIN toys t ON t.id = p.toy_id LEFT JOIN rooms r ON r.id = t.room_id
 LEFT JOIN storage_spots s ON s.id = t.storage_spot_id AND s.room_id = t.room_id`;

export async function createPlaySession(database: DatabaseConnection, childId: number, toyId: number): Promise<PlaySession> {
  const timestamp = now();
  const householdId = await getActiveHouseholdId(database);
  try {
    const result = await database.runAsync('INSERT INTO play_sessions (child_id, toy_id, status, started_at, completed_at, cleanup_started_at, help_requested, parent_override_used, created_at, updated_at, household_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);', childId, toyId, 'active', timestamp, null, null, 0, 0, timestamp, timestamp, householdId);
    const session = await getPlaySession(database, result.lastInsertRowId);
    if (!session) throw new Error('Created play session could not be loaded.');
    return session;
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : '';
    if (/unique|constraint/i.test(message)) throw new Error('That toy is already being played with, or this child already has a current toy. Choose another toy or finish cleanup first.');
    throw error;
  }
}

export async function getPlaySession(database: DatabaseConnection, id: number): Promise<PlaySession | null> {
  const row = await database.getFirstAsync<PlaySessionRow>(
    `SELECT ${SESSION_COLUMNS} FROM play_sessions p WHERE p.id = ? AND p.household_id = ?;`,
    id,
    await getActiveHouseholdId(database),
  );
  return row ? toSession(row) : null;
}

export async function getActivePlaySession(database: DatabaseConnection, childId: number): Promise<ActivePlaySession | null> {
  const row = await database.getFirstAsync<ActiveSessionRow>(
    `${ACTIVE_JOIN} WHERE p.status = ? AND p.child_id = ? AND p.household_id = ? ORDER BY p.id DESC LIMIT 1;`,
    'active',
    childId,
    await getActiveHouseholdId(database),
  );
  return row ? mapActive(row) : null;
}

export async function listActivePlaySessions(database: DatabaseConnection): Promise<ActivePlaySession[]> {
  const rows = await database.getAllAsync<ActiveSessionRow>(
    `${ACTIVE_JOIN} WHERE p.status = ? AND p.household_id = ? ORDER BY c.name COLLATE NOCASE, p.id;`,
    'active',
    await getActiveHouseholdId(database),
  );
  return rows.map(mapActive);
}

/**
 * Whether a child has ever been handed the phone.
 *
 * Read from the sessions that already exist rather than from a new settings
 * column, so the answer is right for households created before Parent Home
 * started asking the question.
 */
export async function hasEverPlayed(database: DatabaseConnection): Promise<boolean> {
  const row = await database.getFirstAsync<{ total: number }>(
    'SELECT COUNT(*) AS total FROM play_sessions WHERE household_id = ?;',
    await getActiveHouseholdId(database),
  );
  return (row?.total ?? 0) > 0;
}

export async function startPlaySessionIfNoneActive(database: DatabaseConnection, childId: number, toyId: number): Promise<ActivePlaySession> {
  let session: ActivePlaySession | null = null;
  await database.withTransactionAsync(async () => {
    const householdId = await getActiveHouseholdId(database);
    const child = await database.getFirstAsync<{ id: number }>('SELECT id FROM child_profiles WHERE id = ? AND household_id = ?;', childId, householdId);
    if (!child) throw new Error('This child profile is no longer available.');
    session = await getActivePlaySession(database, childId);
    if (session) return;
    const toy = await database.getFirstAsync<{ id: number }>('SELECT id FROM toys WHERE id = ? AND household_id = ? AND is_available = 1 AND is_archived = 0;', toyId, householdId);
    if (!toy) throw new Error('This toy is no longer available. Choose another toy.');
    const toyConflict = await database.getFirstAsync<{ child_name: string }>(`SELECT c.name AS child_name FROM play_sessions p JOIN child_profiles c ON c.id = p.child_id WHERE p.toy_id = ? AND p.status = 'active' LIMIT 1;`, toyId);
    if (toyConflict) throw new Error(`${toyConflict.child_name} is already playing with this toy. Choose another toy.`);
    await createPlaySession(database, childId, toyId);
    session = await getActivePlaySession(database, childId);
  });
  if (!session) throw new Error('Play session could not be started.');
  void telemetry.track('session_started');
  return session;
}

export async function completePlaySession(database: DatabaseConnection, id: number, childId?: number): Promise<PlaySession> {
  const timestamp = now();
  const result = childId === undefined
    ? await database.runAsync('UPDATE play_sessions SET status = ?, completed_at = ?, updated_at = ? WHERE id = ? AND status = ?;', 'completed', timestamp, timestamp, id, 'active')
    : await database.runAsync('UPDATE play_sessions SET status = ?, completed_at = ?, updated_at = ? WHERE id = ? AND child_id = ? AND status = ?;', 'completed', timestamp, timestamp, id, childId, 'active');
  if (result.changes !== 1) throw new Error('Active play session could not be completed.');
  const session = await getPlaySession(database, id);
  if (!session) throw new Error('Completed play session could not be loaded.');
  void telemetry.track('session_completed');
  return session;
}

export async function markCleanupStarted(database: DatabaseConnection, id: number, childId: number): Promise<PlaySession> {
  const timestamp = now();
  const result = await database.runAsync('UPDATE play_sessions SET cleanup_started_at = COALESCE(cleanup_started_at, ?), updated_at = ? WHERE id = ? AND child_id = ? AND status = ?;', timestamp, timestamp, id, childId, 'active');
  if (result.changes !== 1) throw new Error('Cleanup could not be started.');
  const session = await getPlaySession(database, id); if (!session) throw new Error('Cleanup session could not be loaded.'); return session;
}

export async function markCleanupStep(database: DatabaseConnection, id: number, childId: number, step: number): Promise<PlaySession> {
  if (!Number.isInteger(step) || step < 0 || step > 2) throw new Error('Cleanup step is invalid.');
  const timestamp = now();
  const result = await database.runAsync('UPDATE play_sessions SET cleanup_step = ?, updated_at = ? WHERE id = ? AND child_id = ? AND status = ?;', step, timestamp, id, childId, 'active');
  if (result.changes !== 1) throw new Error('Cleanup progress could not be saved.');
  const session = await getPlaySession(database, id);
  if (!session) throw new Error('Cleanup session could not be loaded.');
  return session;
}

export async function markCleanupHelpRequested(database: DatabaseConnection, id: number, childId: number): Promise<PlaySession> {
  const timestamp = now();
  const result = await database.runAsync('UPDATE play_sessions SET help_requested = ?, updated_at = ? WHERE id = ? AND child_id = ? AND status = ?;', 1, timestamp, id, childId, 'active');
  if (result.changes !== 1) throw new Error('Cleanup help could not be requested.');
  const session = await getPlaySession(database, id); if (!session) throw new Error('Cleanup session could not be loaded.'); return session;
}

export async function completePlaySessionWithParentOverride(database: DatabaseConnection, id: number, childId?: number): Promise<PlaySession> {
  const timestamp = now();
  const result = childId === undefined
    ? await database.runAsync('UPDATE play_sessions SET status = ?, completed_at = ?, parent_override_used = ?, updated_at = ? WHERE id = ? AND status = ?;', 'completed', timestamp, 1, timestamp, id, 'active')
    : await database.runAsync('UPDATE play_sessions SET status = ?, completed_at = ?, parent_override_used = ?, updated_at = ? WHERE id = ? AND child_id = ? AND status = ?;', 'completed', timestamp, 1, timestamp, id, childId, 'active');
  if (result.changes !== 1) throw new Error('Active play session could not be completed.');
  const session = await getPlaySession(database, id); if (!session) throw new Error('Completed play session could not be loaded.'); return session;
}
