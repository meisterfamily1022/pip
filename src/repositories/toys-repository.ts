import type { Toy } from '@/domain/models';
import { isPlayCategory, type PlayCategory } from '@/domain/play-category';
import type { ToyRow } from '@/database/rows';
import type { DatabaseConnection } from '@/database/types';
import { getActiveHouseholdId } from '@/features/household/household-scope';

type CategoryRow = { category: string };
const now = (): string => new Date().toISOString();

function mapToy(row: ToyRow, categories: PlayCategory[]): Toy {
  const originalImageUri = row.original_image_uri ?? row.image_uri;
  const imageUri = row.preferred_image_variant === 'enhanced' && row.enhanced_image_uri ? row.enhanced_image_uri : originalImageUri;
  return { id: row.id, name: row.name, imageUri, originalImageUri, enhancedImageUri: row.enhanced_image_uri, preferredImageVariant: row.preferred_image_variant ?? 'original', aiMetadataStatus: row.ai_metadata_status ?? 'manual', aiAnalysisId: row.ai_analysis_id, aiSchemaVersion: row.ai_schema_version, aiConsentAt: row.ai_consent_at, aiConfirmedAt: row.ai_confirmed_at, roomId: row.room_id, storageSpotId: row.storage_spot_id, cleanupDifficulty: row.cleanup_difficulty, adultHelpRequired: row.adult_help_required === 1, isAvailable: row.is_available === 1, isArchived: row.is_archived === 1, categories, createdAt: row.created_at, updatedAt: row.updated_at, imageRemotePath: row.image_remote_path ?? null };
}

async function getCategories(database: DatabaseConnection, toyId: number): Promise<PlayCategory[]> {
  const rows = await database.getAllAsync<CategoryRow>('SELECT category FROM toy_categories WHERE toy_id = ? ORDER BY category;', toyId);
  return rows.map((row) => {
    if (!isPlayCategory(row.category)) throw new Error('Stored toy category is invalid.');
    return row.category;
  });
}

export type SaveToyInput = {
  name: string;
  imageUri: string | null;
  roomId: number;
  storageSpotId: number;
  cleanupDifficulty: 'easy' | 'medium' | 'big';
  adultHelpRequired: boolean;
  isAvailable: boolean;
  isArchived: boolean;
  categories: readonly PlayCategory[];
  intakeKey?: string | null;
};

export type ChildToy = Toy & { roomName: string; storageSpotName: string };

type ChildToyRow = ToyRow & { room_name: string; storage_spot_name: string };

function mapChildToy(row: ChildToyRow, categories: PlayCategory[]): ChildToy {
  return { ...mapToy(row, categories), roomName: row.room_name, storageSpotName: row.storage_spot_name };
}

/**
 * Every read and write below is scoped to the household this device is showing.
 *
 * The column has existed since migration 9 but nothing filtered on it, and
 * `createToy` never even populated it — so toys added since then carry a NULL
 * household and belong to nobody. Scoping is applied in SQL rather than in the
 * callers so that a stale screen, a queued write or a direct service call
 * cannot reach another family's library by passing an id it should not know.
 */
async function scope(database: DatabaseConnection): Promise<string> {
  return getActiveHouseholdId(database);
}

export async function createToy(database: DatabaseConnection, input: SaveToyInput): Promise<Toy> {
  if (input.categories.length === 0) throw new Error('A toy must have at least one play category.');
  const householdId = await scope(database);
  const timestamp = now();
  let toyId: number | null = null;
  await database.withTransactionAsync(async () => {
    const result = await database.runAsync(
      'INSERT INTO toys (name, image_uri, original_image_uri, enhanced_image_uri, preferred_image_variant, ai_metadata_status, ai_analysis_id, ai_schema_version, ai_consent_at, ai_confirmed_at, room_id, storage_spot_id, cleanup_difficulty, adult_help_required, is_available, is_archived, created_at, updated_at, intake_key, household_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);',
      input.name.trim(), input.imageUri, input.imageUri, null, 'original', 'manual', null, null, null, null, input.roomId, input.storageSpotId, input.cleanupDifficulty, input.adultHelpRequired ? 1 : 0, input.isAvailable ? 1 : 0, input.isArchived ? 1 : 0, timestamp, timestamp, input.intakeKey ?? null, householdId,
    );
    toyId = result.lastInsertRowId;
    for (const category of [...new Set(input.categories)]) {
      await database.runAsync('INSERT INTO toy_categories (toy_id, category, created_at) VALUES (?, ?, ?);', toyId, category, timestamp);
    }
  });
  if (toyId === null) throw new Error('Created toy did not receive an identifier.');
  const toy = await getToy(database, toyId);
  if (!toy) throw new Error('Created toy could not be loaded.');
  return toy;
}

export async function getToy(database: DatabaseConnection, id: number): Promise<Toy | null> {
  const row = await database.getFirstAsync<ToyRow>('SELECT id, name, image_uri, original_image_uri, enhanced_image_uri, preferred_image_variant, ai_metadata_status, ai_analysis_id, ai_schema_version, ai_consent_at, ai_confirmed_at, room_id, storage_spot_id, cleanup_difficulty, adult_help_required, is_available, is_archived, created_at, updated_at FROM toys WHERE id = ? AND household_id = ?;', id, await scope(database));
  return row ? mapToy(row, await getCategories(database, row.id)) : null;
}

/**
 * Who is playing. `null` is Guest — a visitor with no stored profile.
 */
export type ChildAudience = { childId: number | null };

/**
 * Toys this child may currently be offered.
 *
 * Availability is enforced here rather than in the UI, so a stale screen or a
 * direct service call cannot surface a toy the parent put out of reach. Four
 * rules apply, in SQL:
 *
 * - hidden and archived toys never appear
 * - a toy already in someone else's active session never appears, so two
 *   children are not sent to the same physical object
 * - 'parent_only' and 'temporarily_unavailable' toys never appear
 * - 'selected' toys appear only for the children they were chosen for, and
 *   never for Guest, who is nobody's selected child
 */
export async function listChildToys(
  database: DatabaseConnection,
  audience: ChildAudience = { childId: null },
): Promise<ChildToy[]> {
  const rows = await database.getAllAsync<ChildToyRow>(
    `SELECT t.id, t.name, t.image_uri, t.original_image_uri, t.enhanced_image_uri, t.preferred_image_variant, t.ai_metadata_status, t.ai_analysis_id, t.ai_schema_version, t.ai_consent_at, t.ai_confirmed_at, t.room_id, t.storage_spot_id, t.cleanup_difficulty, t.adult_help_required, t.is_available, t.is_archived,
            t.created_at, t.updated_at, r.name AS room_name, s.name AS storage_spot_name
       FROM toys t
       JOIN rooms r ON r.id = t.room_id
       JOIN storage_spots s ON s.id = t.storage_spot_id AND s.room_id = t.room_id
      WHERE t.household_id = ? AND t.is_available = 1 AND t.is_archived = 0
        AND t.availability_scope IN ('everyone', 'selected')
        AND (
          t.availability_scope = 'everyone'
          OR (? IS NOT NULL AND EXISTS (
            SELECT 1 FROM toy_child_visibility v WHERE v.toy_id = t.id AND v.child_id = ?
          ))
        )
        AND NOT EXISTS (SELECT 1 FROM play_sessions p WHERE p.toy_id = t.id AND p.status = 'active')
      ORDER BY t.name COLLATE NOCASE ASC, t.id ASC;`,
    await scope(database),
    audience.childId,
    audience.childId,
  );
  return Promise.all(rows.map(async (row) => mapChildToy(row, await getCategories(database, row.id))));
}

/** Replaces which children a 'selected' toy is visible to. */
export async function setToyChildVisibility(
  database: DatabaseConnection,
  toyId: number,
  childIds: readonly number[],
): Promise<void> {
  const timestamp = now();
  await database.withTransactionAsync(async () => {
    await database.runAsync('DELETE FROM toy_child_visibility WHERE toy_id = ?;', toyId);
    for (const childId of new Set(childIds)) {
      await database.runAsync(
        'INSERT OR IGNORE INTO toy_child_visibility (toy_id, child_id, created_at) VALUES (?, ?, ?);',
        toyId,
        childId,
        timestamp,
      );
    }
  });
}

export type ToyAvailabilityScope = 'everyone' | 'selected' | 'parent_only' | 'temporarily_unavailable';

export async function setToyAvailabilityScope(
  database: DatabaseConnection,
  toyId: number,
  scope: ToyAvailabilityScope,
): Promise<void> {
  const result = await database.runAsync(
    'UPDATE toys SET availability_scope = ?, updated_at = ? WHERE id = ?;',
    scope,
    now(),
    toyId,
  );
  if (result.changes !== 1) throw new Error('Toy not found.');
}

export type ParentToy = ChildToy;

export type ToyFilters = {
  search?: string;
  roomId?: number | null;
  storageSpotId?: number | null;
  category?: PlayCategory | null;
  cleanupDifficulty?: Toy['cleanupDifficulty'] | null;
  adultHelpRequired?: boolean | null;
  availability?: 'all' | 'available' | 'hidden';
  archived?: 'active' | 'archived' | 'all';
};

function appendFilter(clauses: string[], parameters: (string | number | null)[], condition: string, value: string | number | null): void {
  clauses.push(condition);
  parameters.push(value);
}

export async function listParentToys(database: DatabaseConnection, filters: ToyFilters = {}): Promise<ParentToy[]> {
  const clauses: string[] = [];
  const parameters: (string | number | null)[] = [];
  appendFilter(clauses, parameters, 't.household_id = ?', await scope(database));
  const archived = filters.archived ?? 'active';
  if (archived !== 'all') appendFilter(clauses, parameters, 't.is_archived = ?', archived === 'archived' ? 1 : 0);
  if (filters.availability === 'available') appendFilter(clauses, parameters, 't.is_available = ?', 1);
  if (filters.availability === 'hidden') appendFilter(clauses, parameters, 't.is_available = ?', 0);
  if (filters.roomId) appendFilter(clauses, parameters, 't.room_id = ?', filters.roomId);
  if (filters.storageSpotId) appendFilter(clauses, parameters, 't.storage_spot_id = ?', filters.storageSpotId);
  if (filters.cleanupDifficulty) appendFilter(clauses, parameters, 't.cleanup_difficulty = ?', filters.cleanupDifficulty);
  if (filters.adultHelpRequired !== undefined && filters.adultHelpRequired !== null) appendFilter(clauses, parameters, 't.adult_help_required = ?', filters.adultHelpRequired ? 1 : 0);
  const search = filters.search?.trim();
  if (search) appendFilter(clauses, parameters, 't.name LIKE ? COLLATE NOCASE', `%${search}%`);
  if (filters.category) appendFilter(clauses, parameters, 'EXISTS (SELECT 1 FROM toy_categories tc WHERE tc.toy_id = t.id AND tc.category = ?)', filters.category);
  const where = `WHERE ${clauses.join(' AND ')}`;
  const rows = await database.getAllAsync<ChildToyRow>(
    `SELECT t.id, t.name, t.image_uri, t.original_image_uri, t.enhanced_image_uri, t.preferred_image_variant, t.ai_metadata_status, t.ai_analysis_id, t.ai_schema_version, t.ai_consent_at, t.ai_confirmed_at, t.room_id, t.storage_spot_id, t.cleanup_difficulty, t.adult_help_required, t.is_available, t.is_archived,
            t.created_at, t.updated_at, r.name AS room_name, s.name AS storage_spot_name
       FROM toys t
       JOIN rooms r ON r.id = t.room_id
       JOIN storage_spots s ON s.id = t.storage_spot_id AND s.room_id = t.room_id
      ${where}
      ORDER BY t.name COLLATE NOCASE ASC, t.id ASC;`,
    ...parameters,
  );
  return Promise.all(rows.map(async (row) => mapChildToy(row, await getCategories(database, row.id))));
}

export async function getParentToy(database: DatabaseConnection, id: number): Promise<ParentToy | null> {
  const row = await database.getFirstAsync<ChildToyRow>(
    `SELECT t.id, t.name, t.image_uri, t.original_image_uri, t.enhanced_image_uri, t.preferred_image_variant, t.ai_metadata_status, t.ai_analysis_id, t.ai_schema_version, t.ai_consent_at, t.ai_confirmed_at, t.room_id, t.storage_spot_id, t.cleanup_difficulty, t.adult_help_required, t.is_available, t.is_archived,
            t.created_at, t.updated_at, t.image_remote_path, r.name AS room_name, s.name AS storage_spot_name
       FROM toys t
       JOIN rooms r ON r.id = t.room_id
       JOIN storage_spots s ON s.id = t.storage_spot_id AND s.room_id = t.room_id
      WHERE t.id = ? AND t.household_id = ?;`,
    id,
    await scope(database),
  );
  return row ? mapChildToy(row, await getCategories(database, row.id)) : null;
}

/**
 * Records the exact remote object a toy's photo was last uploaded to (or
 * clears it, after that object is removed). Kept separate from `updateToy`
 * because this is bookkeeping the backup pipeline owns, not something a
 * parent's edit ever sets.
 */
export async function setToyRemoteImagePath(database: DatabaseConnection, id: number, path: string | null): Promise<void> {
  await database.runAsync('UPDATE toys SET image_remote_path = ? WHERE id = ? AND household_id = ?;', path, id, await scope(database));
}

export async function getParentToyByIntakeKey(database: DatabaseConnection, intakeKey: string): Promise<ParentToy | null> {
  const row = await database.getFirstAsync<ChildToyRow>(
    `SELECT t.id, t.name, t.image_uri, t.original_image_uri, t.enhanced_image_uri, t.preferred_image_variant, t.ai_metadata_status, t.ai_analysis_id, t.ai_schema_version, t.ai_consent_at, t.ai_confirmed_at, t.room_id, t.storage_spot_id, t.cleanup_difficulty, t.adult_help_required, t.is_available, t.is_archived,
            t.created_at, t.updated_at, r.name AS room_name, s.name AS storage_spot_name
       FROM toys t
       JOIN rooms r ON r.id = t.room_id
       JOIN storage_spots s ON s.id = t.storage_spot_id AND s.room_id = t.room_id
      WHERE t.intake_key = ? AND t.household_id = ?;`,
    intakeKey,
    await scope(database),
  );
  return row ? mapChildToy(row, await getCategories(database, row.id)) : null;
}

export async function updateToy(database: DatabaseConnection, id: number, input: SaveToyInput): Promise<Toy> {
  if (input.categories.length === 0) throw new Error('A toy must have at least one play category.');
  const householdId = await scope(database);
  const timestamp = now();
  await database.withTransactionAsync(async () => {
    const result = await database.runAsync(
      'UPDATE toys SET name = ?, image_uri = ?, original_image_uri = ?, enhanced_image_uri = NULL, preferred_image_variant = ?, ai_metadata_status = ?, ai_analysis_id = NULL, ai_schema_version = NULL, ai_consent_at = NULL, ai_confirmed_at = NULL, room_id = ?, storage_spot_id = ?, cleanup_difficulty = ?, adult_help_required = ?, is_available = ?, is_archived = ?, updated_at = ? WHERE id = ? AND household_id = ?;',
      input.name.trim(), input.imageUri, input.imageUri, 'original', 'manual', input.roomId, input.storageSpotId, input.cleanupDifficulty, input.adultHelpRequired ? 1 : 0, input.isAvailable ? 1 : 0, input.isArchived ? 1 : 0, timestamp, id, householdId,
    );
    if (result.changes !== 1) throw new Error('Toy not found.');
    await database.runAsync('DELETE FROM toy_categories WHERE toy_id = ?;', id);
    for (const category of [...new Set(input.categories)]) {
      await database.runAsync('INSERT INTO toy_categories (toy_id, category, created_at) VALUES (?, ?, ?);', id, category, timestamp);
    }
  });
  const toy = await getToy(database, id);
  if (!toy) throw new Error('Updated toy could not be loaded.');
  return toy;
}

export async function setToyArchived(database: DatabaseConnection, id: number, archived: boolean): Promise<void> {
  const result = await database.runAsync('UPDATE toys SET is_archived = ?, updated_at = ? WHERE id = ? AND household_id = ?;', archived ? 1 : 0, now(), id, await scope(database));
  if (result.changes !== 1) throw new Error('Toy not found.');
}

export async function setToyAvailable(database: DatabaseConnection, id: number, available: boolean): Promise<void> {
  const result = await database.runAsync('UPDATE toys SET is_available = ?, updated_at = ? WHERE id = ? AND household_id = ?;', available ? 1 : 0, now(), id, await scope(database));
  if (result.changes !== 1) throw new Error('Toy not found.');
}

export async function deleteToy(database: DatabaseConnection, id: number): Promise<void> {
  const householdId = await scope(database);
  await database.withTransactionAsync(async () => {
    // Ownership is checked before anything is removed. play_sessions references
    // toys with ON DELETE RESTRICT, so the toy itself has to go last — which
    // would otherwise mean deleting another household's sessions before finding
    // out the toy was never ours.
    const owned = await database.getFirstAsync<{ id: number }>(
      'SELECT id FROM toys WHERE id = ? AND household_id = ?;',
      id,
      householdId,
    );
    if (!owned) throw new Error('Toy not found.');
    await database.runAsync('DELETE FROM play_sessions WHERE toy_id = ?;', id);
    await database.runAsync('DELETE FROM toy_categories WHERE toy_id = ?;', id);
    const result = await database.runAsync('DELETE FROM toys WHERE id = ? AND household_id = ?;', id, householdId);
    if (result.changes !== 1) throw new Error('Toy not found.');
  });
}

/** Toys in the library, excluding archived ones. */
export async function countToys(database: DatabaseConnection, includeArchived = false): Promise<number> {
  const row = await database.getFirstAsync<{ count: number }>(
    `SELECT COUNT(*) AS count FROM toys WHERE household_id = ?${includeArchived ? '' : ' AND is_archived = 0'};`,
    await scope(database),
  );
  return row?.count ?? 0;
}

export async function countPlaySessionsForToy(database: DatabaseConnection, id: number): Promise<number> {
  const row = await database.getFirstAsync<{ count: number }>('SELECT COUNT(*) AS count FROM play_sessions WHERE toy_id = ?;', id);
  return row?.count ?? 0;
}

export async function countActivePlaySessionsForToy(database: DatabaseConnection, id: number): Promise<number> {
  const row = await database.getFirstAsync<{ count: number }>("SELECT COUNT(*) AS count FROM play_sessions WHERE toy_id = ? AND status = 'active';", id);
  return row?.count ?? 0;
}
