import type { Room, StorageSpot } from '@/domain/models';
import type { DatabaseConnection } from '@/database/types';
import type { RoomRow, StorageSpotRow } from '@/database/rows';

const now = (): string => new Date().toISOString();
const toRoom = (row: RoomRow): Room => ({ id: row.id, name: row.name, createdAt: row.created_at, updatedAt: row.updated_at });
const toStorageSpot = (row: StorageSpotRow): StorageSpot => ({ id: row.id, roomId: row.room_id, name: row.name, createdAt: row.created_at, updatedAt: row.updated_at });

export async function createRoom(database: DatabaseConnection, name: string): Promise<Room> {
  const timestamp = now();
  const result = await database.runAsync('INSERT INTO rooms (name, created_at, updated_at) VALUES (?, ?, ?);', name.trim(), timestamp, timestamp);
  const room = await database.getFirstAsync<RoomRow>('SELECT id, name, created_at, updated_at FROM rooms WHERE id = ?;', result.lastInsertRowId);
  if (!room) throw new Error('Created room could not be loaded.');
  return toRoom(room);
}

export async function getRoom(database: DatabaseConnection, id: number): Promise<Room | null> {
  const row = await database.getFirstAsync<RoomRow>('SELECT id, name, created_at, updated_at FROM rooms WHERE id = ?;', id);
  return row ? toRoom(row) : null;
}

export async function createStorageSpot(database: DatabaseConnection, roomId: number, name: string): Promise<StorageSpot> {
  const timestamp = now();
  const result = await database.runAsync('INSERT INTO storage_spots (room_id, name, created_at, updated_at) VALUES (?, ?, ?, ?);', roomId, name.trim(), timestamp, timestamp);
  const spot = await database.getFirstAsync<StorageSpotRow>('SELECT id, room_id, name, created_at, updated_at FROM storage_spots WHERE id = ?;', result.lastInsertRowId);
  if (!spot) throw new Error('Created storage spot could not be loaded.');
  return toStorageSpot(spot);
}

export async function getStorageSpot(database: DatabaseConnection, id: number): Promise<StorageSpot | null> {
  const row = await database.getFirstAsync<StorageSpotRow>('SELECT id, room_id, name, created_at, updated_at FROM storage_spots WHERE id = ?;', id);
  return row ? toStorageSpot(row) : null;
}
