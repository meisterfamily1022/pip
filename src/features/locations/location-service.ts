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
  reassignToys,
  roomNameExists,
  storageSpotNameExists,
  updateRoom,
  updateStorageSpot,
} from '@/repositories/rooms-repository';

export class LocationConflictError extends Error {}
export class LocationDeletionBlockedError extends Error {}

export type LocationTreeItem = Room & { storageSpots: StorageSpot[] };
export type LocationDeletionImpact = {
  canDelete: boolean;
  message: string;
  storageSpotCount: number;
  toyCount: number;
};

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
  const impact = await getParentStorageSpotDeletionImpact(database, id);
  if (!impact.canDelete) throw new LocationDeletionBlockedError(impact.message);
  await deleteStorageSpot(database, id);
}

export async function removeParentRoom(database: DatabaseConnection, id: number): Promise<void> {
  const impact = await getParentRoomDeletionImpact(database, id);
  if (!impact.canDelete) throw new LocationDeletionBlockedError(impact.message);
  await deleteRoom(database, id);
}

export async function getParentStorageSpotDeletionImpact(database: DatabaseConnection, id: number): Promise<LocationDeletionImpact> {
  const existing = await getStorageSpot(database, id);
  if (!existing) throw new Error('Storage spot not found.');
  const toyCount = await countToysAssignedToStorageSpot(database, id);
  return {
    canDelete: toyCount === 0,
    storageSpotCount: 0,
    toyCount,
    message: toyCount > 0
      ? `${toyCount} ${toyCount === 1 ? 'toy is' : 'toys are'} assigned to this storage spot. Move or delete ${toyCount === 1 ? 'it' : 'them'} before deleting the storage spot.`
      : 'This storage spot is empty. Deleting it removes the storage record permanently.',
  };
}

export async function getParentRoomDeletionImpact(database: DatabaseConnection, id: number): Promise<LocationDeletionImpact> {
  const existing = await getRoom(database, id);
  if (!existing) throw new Error('Room not found.');
  const [storageSpotCount, toyCount] = await Promise.all([
    countStorageSpots(database, id),
    countToysAssignedToRoom(database, id),
  ]);
  const dependencies: string[] = [];
  if (storageSpotCount > 0) dependencies.push(`${storageSpotCount} storage ${storageSpotCount === 1 ? 'spot' : 'spots'}`);
  if (toyCount > 0) dependencies.push(`${toyCount} assigned ${toyCount === 1 ? 'toy' : 'toys'}`);
  return {
    canDelete: dependencies.length === 0,
    storageSpotCount,
    toyCount,
    message: dependencies.length > 0
      ? `This room still contains ${dependencies.join(' and ')}. Move or delete those records before deleting the room.`
      : 'This room has no storage spots or toys. Deleting it removes the room permanently.',
  };
}

/**
 * Deletes a room after moving its toys somewhere real.
 *
 * The rule this preserves is that a toy always has a room and a spot. The
 * design's flow makes that visible to the parent: choose the new home, see the
 * consequence stated, then delete. Both halves happen in one transaction, so an
 * interruption leaves either the old room intact or the toys safely moved —
 * never a room half-removed with toys pointing at it.
 */
export async function removeParentRoomWithReassignment(
  database: DatabaseConnection,
  roomId: number,
  targetStorageSpotId: number,
): Promise<number> {
  const target = await getStorageSpot(database, targetStorageSpotId);
  if (!target) throw new Error('Choose somewhere for these toys to go.');
  if (target.roomId === roomId) throw new LocationDeletionBlockedError('Choose a spot in a different room.');
  let moved = 0;
  await database.withTransactionAsync(async () => {
    moved = await reassignToys(database, { roomId }, targetStorageSpotId);
    for (const spot of await listStorageSpots(database, roomId)) await deleteStorageSpot(database, spot.id);
    await deleteRoom(database, roomId);
  });
  return moved;
}

/** The same, for a single storage spot: move its toys, then remove it. */
export async function removeParentStorageSpotWithReassignment(
  database: DatabaseConnection,
  storageSpotId: number,
  targetStorageSpotId: number,
): Promise<number> {
  if (storageSpotId === targetStorageSpotId) throw new LocationDeletionBlockedError('Choose a different spot.');
  let moved = 0;
  await database.withTransactionAsync(async () => {
    moved = await reassignToys(database, { storageSpotId }, targetStorageSpotId);
    await deleteStorageSpot(database, storageSpotId);
  });
  return moved;
}
