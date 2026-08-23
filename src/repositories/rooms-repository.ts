import type { Room, StorageSpot } from '@/domain/models';
import type { DatabaseConnection } from '@/database/types';
import type { RoomRow, StorageSpotRow } from '@/database/rows';
import { getActiveHouseholdId } from '@/features/household/household-scope';

const now = (): string => new Date().toISOString();
const toRoom = (row: RoomRow): Room => ({ id: row.id, name: row.name, createdAt: row.created_at, updatedAt: row.updated_at });
const toStorageSpot = (row: StorageSpotRow): StorageSpot => ({ id: row.id, roomId: row.room_id, name: row.name, createdAt: row.created_at, updatedAt: row.updated_at });

type CountRow = { count: number };
type IdRow = { id: number };

/**
 * Rooms and storage spots belong to a household like everything else.
 *
 * Without this, a name-uniqueness check leaked the existence of another
 * family's rooms, and `reassignToys` would happily move toys across households
 * given an id it had no business accepting.
 */
async function scope(database: DatabaseConnection): Promise<string> {
  return getActiveHouseholdId(database);
}

export async function createRoom(database: DatabaseConnection, name: string): Promise<Room> {
  const timestamp = now();
  const result = await database.runAsync('INSERT INTO rooms (name, created_at, updated_at, household_id) VALUES (?, ?, ?, ?);', name.trim(), timestamp, timestamp, await scope(database));
  const room = await database.getFirstAsync<RoomRow>('SELECT id, name, created_at, updated_at FROM rooms WHERE id = ?;', result.lastInsertRowId);
  if (!room) throw new Error('Created room could not be loaded.');
  return toRoom(room);
}

export async function getRoom(database: DatabaseConnection, id: number): Promise<Room | null> {
  const row = await database.getFirstAsync<RoomRow>('SELECT id, name, created_at, updated_at FROM rooms WHERE id = ? AND household_id = ?;', id, await scope(database));
  return row ? toRoom(row) : null;
}

export async function listRooms(database: DatabaseConnection): Promise<Room[]> {
  const rows = await database.getAllAsync<RoomRow>('SELECT id, name, created_at, updated_at FROM rooms WHERE household_id = ? ORDER BY name COLLATE NOCASE ASC, id ASC;', await scope(database));
  return rows.map(toRoom);
}

export async function roomNameExists(database: DatabaseConnection, name: string, excludingId?: number): Promise<boolean> {
  const normalizedName = name.trim();
  const row = excludingId === undefined
    ? await database.getFirstAsync<IdRow>('SELECT id FROM rooms WHERE household_id = ? AND name = ? COLLATE NOCASE LIMIT 1;', await scope(database), normalizedName)
    : await database.getFirstAsync<IdRow>('SELECT id FROM rooms WHERE household_id = ? AND name = ? COLLATE NOCASE AND id != ? LIMIT 1;', await scope(database), normalizedName, excludingId);
  return row !== null;
}

export async function updateRoom(database: DatabaseConnection, id: number, name: string): Promise<Room> {
  const result = await database.runAsync('UPDATE rooms SET name = ?, updated_at = ? WHERE id = ? AND household_id = ?;', name.trim(), now(), id, await scope(database));
  if (result.changes !== 1) throw new Error('Room not found.');
  const room = await getRoom(database, id);
  if (!room) throw new Error('Updated room could not be loaded.');
  return room;
}

export async function deleteRoom(database: DatabaseConnection, id: number): Promise<void> {
  const result = await database.runAsync('DELETE FROM rooms WHERE id = ? AND household_id = ?;', id, await scope(database));
  if (result.changes !== 1) throw new Error('Room not found.');
}

export async function countToysAssignedToRoom(database: DatabaseConnection, roomId: number): Promise<number> {
  const row = await database.getFirstAsync<CountRow>('SELECT COUNT(*) AS count FROM toys WHERE room_id = ? AND household_id = ?;', roomId, await scope(database));
  return row?.count ?? 0;
}

export async function countStorageSpots(database: DatabaseConnection, roomId: number): Promise<number> {
  const row = await database.getFirstAsync<CountRow>('SELECT COUNT(*) AS count FROM storage_spots WHERE room_id = ? AND household_id = ?;', roomId, await scope(database));
  return row?.count ?? 0;
}

export async function createStorageSpot(database: DatabaseConnection, roomId: number, name: string): Promise<StorageSpot> {
  const timestamp = now();
  const result = await database.runAsync('INSERT INTO storage_spots (room_id, name, created_at, updated_at, household_id) VALUES (?, ?, ?, ?, ?);', roomId, name.trim(), timestamp, timestamp, await scope(database));
  const spot = await database.getFirstAsync<StorageSpotRow>('SELECT id, room_id, name, created_at, updated_at FROM storage_spots WHERE id = ?;', result.lastInsertRowId);
  if (!spot) throw new Error('Created storage spot could not be loaded.');
  return toStorageSpot(spot);
}

export async function getStorageSpot(database: DatabaseConnection, id: number): Promise<StorageSpot | null> {
  const row = await database.getFirstAsync<StorageSpotRow>('SELECT id, room_id, name, created_at, updated_at FROM storage_spots WHERE id = ? AND household_id = ?;', id, await scope(database));
  return row ? toStorageSpot(row) : null;
}

export async function listStorageSpots(database: DatabaseConnection, roomId: number): Promise<StorageSpot[]> {
  const rows = await database.getAllAsync<StorageSpotRow>('SELECT id, room_id, name, created_at, updated_at FROM storage_spots WHERE room_id = ? AND household_id = ? ORDER BY name COLLATE NOCASE ASC, id ASC;', roomId, await scope(database));
  return rows.map(toStorageSpot);
}

export async function storageSpotNameExists(database: DatabaseConnection, roomId: number, name: string, excludingId?: number): Promise<boolean> {
  const normalizedName = name.trim();
  const row = excludingId === undefined
    ? await database.getFirstAsync<IdRow>('SELECT id FROM storage_spots WHERE room_id = ? AND household_id = ? AND name = ? COLLATE NOCASE LIMIT 1;', roomId, await scope(database), normalizedName)
    : await database.getFirstAsync<IdRow>('SELECT id FROM storage_spots WHERE room_id = ? AND household_id = ? AND name = ? COLLATE NOCASE AND id != ? LIMIT 1;', roomId, await scope(database), normalizedName, excludingId);
  return row !== null;
}

export async function updateStorageSpot(database: DatabaseConnection, id: number, name: string): Promise<StorageSpot> {
  const result = await database.runAsync('UPDATE storage_spots SET name = ?, updated_at = ? WHERE id = ? AND household_id = ?;', name.trim(), now(), id, await scope(database));
  if (result.changes !== 1) throw new Error('Storage spot not found.');
  const spot = await getStorageSpot(database, id);
  if (!spot) throw new Error('Updated storage spot could not be loaded.');
  return spot;
}

export async function deleteStorageSpot(database: DatabaseConnection, id: number): Promise<void> {
  const result = await database.runAsync('DELETE FROM storage_spots WHERE id = ? AND household_id = ?;', id, await scope(database));
  if (result.changes !== 1) throw new Error('Storage spot not found.');
}

export async function countToysAssignedToStorageSpot(database: DatabaseConnection, storageSpotId: number): Promise<number> {
  const row = await database.getFirstAsync<CountRow>('SELECT COUNT(*) AS count FROM toys WHERE storage_spot_id = ? AND household_id = ?;', storageSpotId, await scope(database));
  return row?.count ?? 0;
}

/**
 * Moves every toy in a room, or in a single spot, to another storage spot.
 *
 * Written as one statement inside the caller's transaction so a toy is never
 * briefly pointing at a room that no longer exists. Returns how many moved, so
 * the caller can tell the parent what actually happened.
 */
export async function reassignToys(
  database: DatabaseConnection,
  source: { roomId: number } | { storageSpotId: number },
  targetStorageSpotId: number,
): Promise<number> {
  const target = await getStorageSpot(database, targetStorageSpotId);
  if (!target) throw new Error('Choose somewhere for these toys to go.');
  const timestamp = new Date().toISOString();
  const result = 'roomId' in source
    ? await database.runAsync(
      'UPDATE toys SET room_id = ?, storage_spot_id = ?, updated_at = ? WHERE room_id = ? AND household_id = ?;',
      target.roomId, target.id, timestamp, source.roomId, await scope(database),
    )
    : await database.runAsync(
      'UPDATE toys SET room_id = ?, storage_spot_id = ?, updated_at = ? WHERE storage_spot_id = ? AND household_id = ?;',
      target.roomId, target.id, timestamp, source.storageSpotId, await scope(database),
    );
  return result.changes ?? 0;
}
