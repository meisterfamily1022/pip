import type { DatabaseConnection } from '@/database/types';
import type { Room, StorageSpot } from '@/domain/models';
import {
  countStorageSpots,
  countToysAssignedToRoom,
  countToysAssignedToStorageSpot,
  createRoom,
  createStorageSpot,
  deleteRoom,
  deleteStorageSpot,
  getRoom,
  getStorageSpot,
  listRooms,
  listStorageSpots,
  roomNameExists,
  storageSpotNameExists,
  updateRoom,
  updateStorageSpot,
} from '@/repositories/rooms-repository';

export class LocationConflictError extends Error {}
export class LocationDeletionBlockedError extends Error {}

export type LocationTreeItem = Room & { storageSpots: StorageSpot[] };

export async function getParentRoom(database: DatabaseConnection, id: number): Promise<Room> {
  const room = await getRoom(database, id);
  if (!room) throw new Error('Room not found.');
  return room;
}

export async function getParentStorageSpot(database: DatabaseConnection, id: number): Promise<StorageSpot & { roomName: string }> {
  const spot = await getStorageSpot(database, id);
  if (!spot) throw new Error('Storage spot not found.');
  const room = await getParentRoom(database, spot.roomId);
  return { ...spot, roomName: room.name };
}

function isUniqueConstraintError(error: unknown): boolean {
  return error instanceof Error && error.message.toUpperCase().includes('UNIQUE');
}

export async function loadLocationTree(database: DatabaseConnection): Promise<LocationTreeItem[]> {
  const rooms = await listRooms(database);
  return Promise.all(rooms.map(async (room) => ({ ...room, storageSpots: await listStorageSpots(database, room.id) })));
}

export async function createParentRoom(database: DatabaseConnection, name: string): Promise<Room> {
  const normalizedName = name.trim();
  if (!normalizedName) throw new Error('Room name is required.');
  if (await roomNameExists(database, normalizedName)) throw new LocationConflictError('A room with that name already exists.');
  try {
    return await createRoom(database, normalizedName);
  } catch (error: unknown) {
    if (isUniqueConstraintError(error)) throw new LocationConflictError('A room with that name already exists.');
    throw error;
  }
}

export async function createParentStorageSpot(database: DatabaseConnection, roomId: number, name: string): Promise<StorageSpot> {
  const room = await getRoom(database, roomId);
  if (!room) throw new Error('Room not found.');
  const normalizedName = name.trim();
  if (!normalizedName) throw new Error('Storage spot name is required.');
  if (await storageSpotNameExists(database, roomId, normalizedName)) throw new LocationConflictError('A storage spot with that name already exists in this room.');
  try {
    return await createStorageSpot(database, roomId, normalizedName);
  } catch (error: unknown) {
    if (isUniqueConstraintError(error)) throw new LocationConflictError('A storage spot with that name already exists in this room.');
    throw error;
  }
}

export async function renameParentRoom(database: DatabaseConnection, id: number, name: string): Promise<Room> {
  const existing = await getRoom(database, id);
  if (!existing) throw new Error('Room not found.');
  const normalizedName = name.trim();
  if (!normalizedName) throw new Error('Room name is required.');
  if (await roomNameExists(database, normalizedName, id)) throw new LocationConflictError('A room with that name already exists.');
  try {
    return await updateRoom(database, id, normalizedName);
  } catch (error: unknown) {
    if (isUniqueConstraintError(error)) throw new LocationConflictError('A room with that name already exists.');
    throw error;
  }
}

export async function renameParentStorageSpot(database: DatabaseConnection, id: number, name: string): Promise<StorageSpot> {
  const existing = await getStorageSpot(database, id);
  if (!existing) throw new Error('Storage spot not found.');
  const normalizedName = name.trim();
  if (!normalizedName) throw new Error('Storage spot name is required.');
  if (await storageSpotNameExists(database, existing.roomId, normalizedName, id)) throw new LocationConflictError('A storage spot with that name already exists in this room.');
  try {
    return await updateStorageSpot(database, id, normalizedName);
  } catch (error: unknown) {
    if (isUniqueConstraintError(error)) throw new LocationConflictError('A storage spot with that name already exists in this room.');
    throw error;
  }
}

export async function removeParentStorageSpot(database: DatabaseConnection, id: number): Promise<void> {
  const existing = await getStorageSpot(database, id);
  if (!existing) throw new Error('Storage spot not found.');
  if (await countToysAssignedToStorageSpot(database, id) > 0) throw new LocationDeletionBlockedError('This storage spot cannot be deleted because toys are assigned to it.');
  await deleteStorageSpot(database, id);
}

export async function removeParentRoom(database: DatabaseConnection, id: number): Promise<void> {
  const existing = await getRoom(database, id);
  if (!existing) throw new Error('Room not found.');
  if (await countStorageSpots(database, id) > 0) throw new LocationDeletionBlockedError('Remove this room’s storage spots before deleting the room.');
  if (await countToysAssignedToRoom(database, id) > 0) throw new LocationDeletionBlockedError('This room cannot be deleted because toys are assigned to it.');
  await deleteRoom(database, id);
}
