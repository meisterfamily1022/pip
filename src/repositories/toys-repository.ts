import type { Toy } from '@/domain/models';
import { isPlayCategory, type PlayCategory } from '@/domain/play-category';
import type { ToyRow } from '@/database/rows';
import type { DatabaseConnection } from '@/database/types';

type CategoryRow = { category: string };
const now = (): string => new Date().toISOString();

function mapToy(row: ToyRow, categories: PlayCategory[]): Toy {
  return { id: row.id, name: row.name, imageUri: row.image_uri, roomId: row.room_id, storageSpotId: row.storage_spot_id, cleanupDifficulty: row.cleanup_difficulty, adultHelpRequired: row.adult_help_required === 1, isAvailable: row.is_available === 1, isArchived: row.is_archived === 1, categories, createdAt: row.created_at, updatedAt: row.updated_at };
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
};

export type ChildToy = Toy & { roomName: string; storageSpotName: string };

type ChildToyRow = ToyRow & { room_name: string; storage_spot_name: string };

function mapChildToy(row: ChildToyRow, categories: PlayCategory[]): ChildToy {
  return { ...mapToy(row, categories), roomName: row.room_name, storageSpotName: row.storage_spot_name };
}

export async function createToy(database: DatabaseConnection, input: SaveToyInput): Promise<Toy> {
  if (input.categories.length === 0) throw new Error('A toy must have at least one play category.');
  const timestamp = now();
  let toyId: number | null = null;
  await database.withTransactionAsync(async () => {
    const result = await database.runAsync(
      'INSERT INTO toys (name, image_uri, room_id, storage_spot_id, cleanup_difficulty, adult_help_required, is_available, is_archived, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?);',
      input.name.trim(), input.imageUri, input.roomId, input.storageSpotId, input.cleanupDifficulty, input.adultHelpRequired ? 1 : 0, input.isAvailable ? 1 : 0, input.isArchived ? 1 : 0, timestamp, timestamp,
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
  const row = await database.getFirstAsync<ToyRow>('SELECT id, name, image_uri, room_id, storage_spot_id, cleanup_difficulty, adult_help_required, is_available, is_archived, created_at, updated_at FROM toys WHERE id = ?;', id);
  return row ? mapToy(row, await getCategories(database, row.id)) : null;
}

export async function listChildToys(database: DatabaseConnection): Promise<ChildToy[]> {
  const rows = await database.getAllAsync<ChildToyRow>(
    `SELECT t.id, t.name, t.image_uri, t.room_id, t.storage_spot_id, t.cleanup_difficulty, t.adult_help_required, t.is_available, t.is_archived,
            t.created_at, t.updated_at, r.name AS room_name, s.name AS storage_spot_name
       FROM toys t
       JOIN rooms r ON r.id = t.room_id
       JOIN storage_spots s ON s.id = t.storage_spot_id AND s.room_id = t.room_id
      WHERE t.is_available = 1 AND t.is_archived = 0
      ORDER BY t.name COLLATE NOCASE ASC, t.id ASC;`,
  );
  return Promise.all(rows.map(async (row) => mapChildToy(row, await getCategories(database, row.id))));
}

export type ParentToy = ChildToy;

export type ToyFilters = {
  search?: string;
  roomId?: number | null;
  category?: PlayCategory | null;
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
  const archived = filters.archived ?? 'active';
  if (archived !== 'all') appendFilter(clauses, parameters, 't.is_archived = ?', archived === 'archived' ? 1 : 0);
  if (filters.availability === 'available') appendFilter(clauses, parameters, 't.is_available = ?', 1);
  if (filters.availability === 'hidden') appendFilter(clauses, parameters, 't.is_available = ?', 0);
  if (filters.roomId) appendFilter(clauses, parameters, 't.room_id = ?', filters.roomId);
  const search = filters.search?.trim();
  if (search) appendFilter(clauses, parameters, 't.name LIKE ? COLLATE NOCASE', `%${search}%`);
  if (filters.category) appendFilter(clauses, parameters, 'EXISTS (SELECT 1 FROM toy_categories tc WHERE tc.toy_id = t.id AND tc.category = ?)', filters.category);
  const where = clauses.length > 0 ? `WHERE ${clauses.join(' AND ')}` : '';
  const rows = await database.getAllAsync<ChildToyRow>(
    `SELECT t.id, t.name, t.image_uri, t.room_id, t.storage_spot_id, t.cleanup_difficulty, t.adult_help_required, t.is_available, t.is_archived,
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
    `SELECT t.id, t.name, t.image_uri, t.room_id, t.storage_spot_id, t.cleanup_difficulty, t.adult_help_required, t.is_available, t.is_archived,
            t.created_at, t.updated_at, r.name AS room_name, s.name AS storage_spot_name
       FROM toys t
       JOIN rooms r ON r.id = t.room_id
       JOIN storage_spots s ON s.id = t.storage_spot_id AND s.room_id = t.room_id
      WHERE t.id = ?;`,
    id,
  );
  return row ? mapChildToy(row, await getCategories(database, row.id)) : null;
}

export async function updateToy(database: DatabaseConnection, id: number, input: SaveToyInput): Promise<Toy> {
  if (input.categories.length === 0) throw new Error('A toy must have at least one play category.');
  const timestamp = now();
  await database.withTransactionAsync(async () => {
    const result = await database.runAsync(
      'UPDATE toys SET name = ?, image_uri = ?, room_id = ?, storage_spot_id = ?, cleanup_difficulty = ?, adult_help_required = ?, is_available = ?, is_archived = ?, updated_at = ? WHERE id = ?;',
      input.name.trim(), input.imageUri, input.roomId, input.storageSpotId, input.cleanupDifficulty, input.adultHelpRequired ? 1 : 0, input.isAvailable ? 1 : 0, input.isArchived ? 1 : 0, timestamp, id,
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
  const result = await database.runAsync('UPDATE toys SET is_archived = ?, updated_at = ? WHERE id = ?;', archived ? 1 : 0, now(), id);
  if (result.changes !== 1) throw new Error('Toy not found.');
}

export async function setToyAvailable(database: DatabaseConnection, id: number, available: boolean): Promise<void> {
  const result = await database.runAsync('UPDATE toys SET is_available = ?, updated_at = ? WHERE id = ?;', available ? 1 : 0, now(), id);
  if (result.changes !== 1) throw new Error('Toy not found.');
}

export async function deleteToy(database: DatabaseConnection, id: number): Promise<void> {
  await database.withTransactionAsync(async () => {
    await database.runAsync('DELETE FROM toy_categories WHERE toy_id = ?;', id);
    const result = await database.runAsync('DELETE FROM toys WHERE id = ?;', id);
    if (result.changes !== 1) throw new Error('Toy not found.');
  });
}
