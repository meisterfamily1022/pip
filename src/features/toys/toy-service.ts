import type { DatabaseConnection } from '@/database/types';
import { PLAY_CATEGORIES, type PlayCategory } from '@/domain/play-category';
import { getRoom, getStorageSpot } from '@/repositories/rooms-repository';
import {
  createToy,
  deleteToy,
  getParentToy,
  setToyArchived,
  setToyAvailable,
  updateToy,
  type ParentToy,
  type SaveToyInput,
} from '@/repositories/toys-repository';
import { deleteUniqueManagedImages, expoToyImageStorage, type ToyImageStorage } from './toy-image-storage';

export class ToyValidationError extends Error {}

export type ToyFormInput = {
  name: string;
  sourceImageUri: string | null;
  existingImageUri?: string | null;
  roomId: number | null;
  storageSpotId: number | null;
  categories: readonly PlayCategory[];
  cleanupDifficulty: 'easy' | 'medium' | 'big';
  adultHelpRequired: boolean;
  isAvailable: boolean;
};

function uniqueCategories(categories: readonly PlayCategory[]): PlayCategory[] {
  return [...new Set(categories)].filter((category) => PLAY_CATEGORIES.includes(category));
}

async function validateToyInput(database: DatabaseConnection, input: ToyFormInput, requireNewPhoto: boolean): Promise<SaveToyInput> {
  const name = input.name.trim();
  if (!input.sourceImageUri && !input.existingImageUri) throw new ToyValidationError('Photo is required.');
  if (requireNewPhoto && !input.sourceImageUri) throw new ToyValidationError('Photo is required.');
  if (!name) throw new ToyValidationError('Toy name is required.');
  if (!input.roomId) throw new ToyValidationError('Room is required.');
  if (!await getRoom(database, input.roomId)) throw new ToyValidationError('Choose a valid room.');
  if (!input.storageSpotId) throw new ToyValidationError('Storage spot is required.');
  const spot = await getStorageSpot(database, input.storageSpotId);
  if (!spot) throw new ToyValidationError('Choose a valid storage spot.');
  if (spot.roomId !== input.roomId) throw new ToyValidationError('Storage spot must belong to the selected room.');
  const categories = uniqueCategories(input.categories);
  if (categories.length === 0) throw new ToyValidationError('Choose at least one category.');
  return {
    name,
    imageUri: input.existingImageUri ?? null,
    roomId: input.roomId,
    storageSpotId: input.storageSpotId,
    cleanupDifficulty: input.cleanupDifficulty,
    adultHelpRequired: input.adultHelpRequired,
    isAvailable: input.isAvailable,
    isArchived: false,
    categories,
  };
}

export async function createParentToy(
  database: DatabaseConnection,
  input: ToyFormInput,
  storage: ToyImageStorage = expoToyImageStorage,
): Promise<ParentToy> {
  const validated = await validateToyInput(database, input, true);
  const managedImageUri = await storage.copyIntoManagedStorage(input.sourceImageUri!);
  try {
    const toy = await createToy(database, { ...validated, imageUri: managedImageUri });
    const parentToy = await getParentToy(database, toy.id);
    if (!parentToy) throw new Error('Created toy could not be loaded.');
    return parentToy;
  } catch (error: unknown) {
    await storage.deleteManagedImage(managedImageUri);
    throw error;
  }
}

export async function updateParentToy(
  database: DatabaseConnection,
  id: number,
  input: ToyFormInput,
  storage: ToyImageStorage = expoToyImageStorage,
): Promise<ParentToy> {
  const existing = await getParentToy(database, id);
  if (!existing) throw new Error('Toy not found.');
  const validated = await validateToyInput(database, input, false);
  const copiedImageUri = input.sourceImageUri ? await storage.copyIntoManagedStorage(input.sourceImageUri) : null;
  const nextImageUri = copiedImageUri ?? input.existingImageUri ?? existing.imageUri;
  try {
    const toy = await updateToy(database, id, { ...validated, imageUri: nextImageUri, isArchived: existing.isArchived });
    if (copiedImageUri) {
      const cleanupFailures = await deleteUniqueManagedImages(storage, [existing.originalImageUri, existing.enhancedImageUri, existing.imageUri].filter((uri) => uri !== copiedImageUri));
      if (cleanupFailures > 0) console.warn('Toy image cleanup incomplete after replacement.');
    }
    const parentToy = await getParentToy(database, toy.id);
    if (!parentToy) throw new Error('Updated toy could not be loaded.');
    return parentToy;
  } catch (error: unknown) {
    if (copiedImageUri) await storage.deleteManagedImage(copiedImageUri);
    throw error;
  }
}

export async function archiveParentToy(database: DatabaseConnection, id: number): Promise<void> {
  await setToyArchived(database, id, true);
}

export async function restoreParentToy(database: DatabaseConnection, id: number): Promise<void> {
  await setToyArchived(database, id, false);
}

export async function setParentToyAvailability(database: DatabaseConnection, id: number, available: boolean): Promise<void> {
  await setToyAvailable(database, id, available);
}

export async function permanentlyDeleteParentToy(
  database: DatabaseConnection,
  id: number,
  storage: ToyImageStorage = expoToyImageStorage,
): Promise<void> {
  const existing = await getParentToy(database, id);
  if (!existing) throw new Error('Toy not found.');
  await deleteToy(database, id);
  try {
    const cleanupFailures = await deleteUniqueManagedImages(storage, [existing.originalImageUri, existing.enhancedImageUri, existing.imageUri]);
    if (cleanupFailures > 0) console.warn('Toy image cleanup incomplete after deletion.');
  } catch {
    // Database deletion is authoritative; image cleanup can be retried by future maintenance.
  }
}
