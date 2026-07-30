import type { DatabaseConnection } from '@/database/types';
import type { Toy } from '@/domain/models';
import type { PlayCategory } from '@/domain/play-category';
import {
  countToys,
  createToy,
  deleteToy,
  getToyWithLocation,
  listToys,
  setToyArchived,
  setToyAvailability,
  updateToy,
  type SaveToyInput,
  type ToyQuery,
  type ToyWithLocation,
} from '@/repositories/toys-repository';
import { deleteToyPhoto, replaceToyPhoto, saveToyPhoto } from '@/services/toy-photos';

/**
 * Parent-facing toy operations.
 *
 * Screens call these rather than the repository directly so photo storage and
 * validation stay in one place.
 */

export class ToyValidationError extends Error {}

/** What the Add/Edit Toy form collects. `imageUri` may be a freshly picked URI. */
export type ToyFormInput = {
  name: string;
  imageUri: string | null;
  roomId: number | null;
  storageSpotId: number | null;
  categories: readonly PlayCategory[];
  isAvailable: boolean;
};

type ValidatedInput = Omit<SaveToyInput, 'isArchived' | 'imageUri'> & { imageUri: string | null };

function validate(input: ToyFormInput): ValidatedInput {
  const name = input.name.trim();
  if (!name) throw new ToyValidationError('Toy name is required.');
  if (input.roomId === null) throw new ToyValidationError('Choose the room where this toy belongs.');
  if (input.storageSpotId === null) throw new ToyValidationError('Choose the storage spot where this toy belongs.');
  if (input.categories.length === 0) throw new ToyValidationError('Choose at least one play category.');
  return {
    name,
    imageUri: input.imageUri,
    roomId: input.roomId,
    storageSpotId: input.storageSpotId,
    categories: input.categories,
    isAvailable: input.isAvailable,
  };
}

export function loadToyLibrary(database: DatabaseConnection, query: ToyQuery = {}): Promise<ToyWithLocation[]> {
  return listToys(database, query);
}

export function loadToy(database: DatabaseConnection, id: number): Promise<ToyWithLocation | null> {
  return getToyWithLocation(database, id);
}

export function countLibraryToys(database: DatabaseConnection): Promise<number> {
  return countToys(database);
}

export async function addToy(database: DatabaseConnection, input: ToyFormInput): Promise<Toy> {
  const validated = validate(input);
  const storedImageUri = validated.imageUri ? await saveToyPhoto(validated.imageUri) : null;
  try {
    return await createToy(database, { ...validated, imageUri: storedImageUri, isArchived: false });
  } catch (error: unknown) {
    await deleteToyPhoto(storedImageUri);
    throw error;
  }
}

export async function saveToy(database: DatabaseConnection, id: number, input: ToyFormInput): Promise<Toy> {
  const validated = validate(input);
  const existing = await getToyWithLocation(database, id);
  if (!existing) throw new Error('Toy not found.');
  const storedImageUri = await replaceToyPhoto(existing.imageUri, validated.imageUri);
  return updateToy(database, id, { ...validated, imageUri: storedImageUri, isArchived: existing.isArchived });
}

export async function removeToy(database: DatabaseConnection, id: number): Promise<void> {
  const existing = await getToyWithLocation(database, id);
  await deleteToy(database, id);
  await deleteToyPhoto(existing?.imageUri ?? null);
}

/** Hidden toys stay in the library but stop appearing in the child's choices. */
export function setToyHidden(database: DatabaseConnection, id: number, hidden: boolean): Promise<Toy> {
  return setToyAvailability(database, id, !hidden);
}

export function setToyArchivedState(database: DatabaseConnection, id: number, archived: boolean): Promise<Toy> {
  return setToyArchived(database, id, archived);
}

export type { ToyQuery, ToyWithLocation };
