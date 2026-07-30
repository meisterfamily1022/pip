import type { Toy } from '@/domain/models';
import { isPlayCategory, type PlayCategory } from '@/domain/play-category';
import type { ToyRow } from '@/database/rows';
import type { DatabaseConnection } from '@/database/types';

type CategoryRow = { category: string };
const now = (): string => new Date().toISOString();

function mapToy(row: ToyRow, categories: PlayCategory[]): Toy {
  return { id: row.id, name: row.name, imageUri: row.image_uri, roomId: row.room_id, storageSpotId: row.storage_spot_id, isAvailable: row.is_available === 1, isArchived: row.is_archived === 1, categories, createdAt: row.created_at, updatedAt: row.updated_at };
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
  isAvailable: boolean;
  isArchived: boolean;
  categories: readonly PlayCategory[];
};

export async function createToy(database: DatabaseConnection, input: SaveToyInput): Promise<Toy> {
  if (input.categories.length === 0) throw new Error('A toy must have at least one play category.');
  const timestamp = now();
  let toyId: number | null = null;
  await database.withTransactionAsync(async () => {
    const result = await database.runAsync(
      'INSERT INTO toys (name, image_uri, room_id, storage_spot_id, is_available, is_archived, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?);',
      input.name.trim(), input.imageUri, input.roomId, input.storageSpotId, input.isAvailable ? 1 : 0, input.isArchived ? 1 : 0, timestamp, timestamp,
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
  const row = await database.getFirstAsync<ToyRow>('SELECT id, name, image_uri, room_id, storage_spot_id, is_available, is_archived, created_at, updated_at FROM toys WHERE id = ?;', id);
  return row ? mapToy(row, await getCategories(database, row.id)) : null;
}

const TOY_COLUMNS =
  't.id, t.name, t.image_uri, t.room_id, t.storage_spot_id, t.is_available, t.is_archived, t.created_at, t.updated_at';

/** A toy joined with the display names of its room and storage spot. */
export type ToyWithLocation = Toy & { roomName: string; storageSpotName: string };

type ToyWithLocationRow = ToyRow & { room_name: string; storage_spot_name: string };

async function withLocation(database: DatabaseConnection, rows: ToyWithLocationRow[]): Promise<ToyWithLocation[]> {
  return Promise.all(
    rows.map(async (row) => ({
      ...mapToy(row, await getCategories(database, row.id)),
      roomName: row.room_name,
      storageSpotName: row.storage_spot_name,
    })),
  );
}

export type ToyQuery = {
  /** Case-insensitive substring match on the toy name. */
  search?: string;
  roomId?: number;
  /** A toy matches when it carries every listed category. */
  categories?: readonly PlayCategory[];
  includeArchived?: boolean;
};

export async function listToys(database: DatabaseConnection, query: ToyQuery = {}): Promise<ToyWithLocation[]> {
  const conditions: string[] = [];
  const parameters: (string | number)[] = [];

  if (!query.includeArchived) conditions.push('t.is_archived = 0');

  const search = query.search?.trim();
  if (search) {
    conditions.push('t.name LIKE ? ESCAPE \'\\\'');
    parameters.push(`%${search.replace(/[\\%_]/g, (match) => `\\${match}`)}%`);
  }

  if (query.roomId !== undefined) {
    conditions.push('t.room_id = ?');
    parameters.push(query.roomId);
  }

  for (const category of new Set(query.categories ?? [])) {
    conditions.push('EXISTS (SELECT 1 FROM toy_categories tc WHERE tc.toy_id = t.id AND tc.category = ?)');
    parameters.push(category);
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  const rows = await database.getAllAsync<ToyWithLocationRow>(
    `SELECT ${TOY_COLUMNS}, r.name AS room_name, s.name AS storage_spot_name
     FROM toys t
     JOIN rooms r ON r.id = t.room_id
     JOIN storage_spots s ON s.id = t.storage_spot_id
     ${where}
     ORDER BY t.name COLLATE NOCASE ASC, t.id ASC;`,
    ...parameters,
  );
  return withLocation(database, rows);
}

export async function getToyWithLocation(database: DatabaseConnection, id: number): Promise<ToyWithLocation | null> {
  const row = await database.getFirstAsync<ToyWithLocationRow>(
    `SELECT ${TOY_COLUMNS}, r.name AS room_name, s.name AS storage_spot_name
     FROM toys t
     JOIN rooms r ON r.id = t.room_id
     JOIN storage_spots s ON s.id = t.storage_spot_id
     WHERE t.id = ?;`,
    id,
  );
  if (!row) return null;
  const [toy] = await withLocation(database, [row]);
  return toy;
}

/**
 * Picks up to `limit` toys a child may be offered: available, not archived, and
 * matching `category` when one is given. Randomised so repeat visits vary.
 */
export async function listSuggestibleToys(
  database: DatabaseConnection,
  category: PlayCategory | null,
  limit: number,
): Promise<ToyWithLocation[]> {
  const categoryClause = category
    ? 'AND EXISTS (SELECT 1 FROM toy_categories tc WHERE tc.toy_id = t.id AND tc.category = ?)'
    : '';
  const parameters: (string | number)[] = category ? [category, limit] : [limit];
  const rows = await database.getAllAsync<ToyWithLocationRow>(
    `SELECT ${TOY_COLUMNS}, r.name AS room_name, s.name AS storage_spot_name
     FROM toys t
     JOIN rooms r ON r.id = t.room_id
     JOIN storage_spots s ON s.id = t.storage_spot_id
     WHERE t.is_archived = 0 AND t.is_available = 1 ${categoryClause}
     ORDER BY RANDOM()
     LIMIT ?;`,
    ...parameters,
  );
  return withLocation(database, rows);
}

export async function updateToy(database: DatabaseConnection, id: number, input: SaveToyInput): Promise<Toy> {
  if (input.categories.length === 0) throw new Error('A toy must have at least one play category.');
  const timestamp = now();
  await database.withTransactionAsync(async () => {
    const result = await database.runAsync(
      'UPDATE toys SET name = ?, image_uri = ?, room_id = ?, storage_spot_id = ?, is_available = ?, is_archived = ?, updated_at = ? WHERE id = ?;',
      input.name.trim(), input.imageUri, input.roomId, input.storageSpotId, input.isAvailable ? 1 : 0, input.isArchived ? 1 : 0, timestamp, id,
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

async function setToyFlag(database: DatabaseConnection, id: number, column: 'is_available' | 'is_archived', value: boolean): Promise<Toy> {
  const result = await database.runAsync(`UPDATE toys SET ${column} = ?, updated_at = ? WHERE id = ?;`, value ? 1 : 0, now(), id);
  if (result.changes !== 1) throw new Error('Toy not found.');
  const toy = await getToy(database, id);
  if (!toy) throw new Error('Updated toy could not be loaded.');
  return toy;
}

/** Hidden toys stay in the library but are never suggested to the child. */
export function setToyAvailability(database: DatabaseConnection, id: number, isAvailable: boolean): Promise<Toy> {
  return setToyFlag(database, id, 'is_available', isAvailable);
}

export function setToyArchived(database: DatabaseConnection, id: number, isArchived: boolean): Promise<Toy> {
  return setToyFlag(database, id, 'is_archived', isArchived);
}

/**
 * Removes the toy and its play history. `play_sessions.toy_id` is RESTRICT, so
 * the sessions have to go first or the delete is rejected.
 */
export async function deleteToy(database: DatabaseConnection, id: number): Promise<void> {
  let deleted = 0;
  await database.withTransactionAsync(async () => {
    await database.runAsync('DELETE FROM play_sessions WHERE toy_id = ?;', id);
    const result = await database.runAsync('DELETE FROM toys WHERE id = ?;', id);
    deleted = result.changes;
  });
  if (deleted !== 1) throw new Error('Toy not found.');
}

export async function countToys(database: DatabaseConnection, includeArchived = false): Promise<number> {
  const row = await database.getFirstAsync<{ count: number }>(
    `SELECT COUNT(*) AS count FROM toys${includeArchived ? '' : ' WHERE is_archived = 0'};`,
  );
  return row?.count ?? 0;
}
