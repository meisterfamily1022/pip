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

export async function listChildToys(database: DatabaseConnection): Promise<ChildToy[]> {
  const rows = await database.getAllAsync<ChildToyRow>(
    `SELECT t.id, t.name, t.image_uri, t.room_id, t.storage_spot_id, t.is_available, t.is_archived,
            t.created_at, t.updated_at, r.name AS room_name, s.name AS storage_spot_name
       FROM toys t
       JOIN rooms r ON r.id = t.room_id
       JOIN storage_spots s ON s.id = t.storage_spot_id AND s.room_id = t.room_id
      WHERE t.is_available = 1 AND t.is_archived = 0
      ORDER BY t.name COLLATE NOCASE ASC, t.id ASC;`,
  );
  return Promise.all(rows.map(async (row) => mapChildToy(row, await getCategories(database, row.id))));
}
