import type { DatabaseConnection } from '@/database/types';
import { PLAY_CATEGORIES, type PlayCategory } from '@/domain/play-category';
import { getRoom, getStorageSpot } from '@/repositories/rooms-repository';
import {
  countPlaySessionsForToy,
  countActivePlaySessionsForToy,
  createToy,
  deleteToy,
  getParentToy,
  getParentToyByIntakeKey,
  listParentToys,
  setToyArchived,
  setToyAvailable,
  updateToy,
  type ParentToy,
  type SaveToyInput,
} from '@/repositories/toys-repository';
import { deleteUniqueManagedImages, expoToyImageStorage, type ToyImageStorage } from './toy-image-storage';
import { telemetry } from '@/features/analytics/telemetry-client';
import { trackLibraryScale } from '@/features/analytics/library-scale';

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
  intakeKey?: string;
};

function uniqueCategories(categories: readonly PlayCategory[]): PlayCategory[] {
  return [...new Set(categories)].filter((category) => PLAY_CATEGORIES.includes(category));
}

async function validateToyInput(database: DatabaseConnection, input: ToyFormInput): Promise<SaveToyInput> {
  const name = input.name.trim();
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
    intakeKey: input.intakeKey ?? null,
  };
}

export async function createParentToy(
  database: DatabaseConnection,
  input: ToyFormInput,
  storage: ToyImageStorage = expoToyImageStorage,
): Promise<ParentToy> {
  if (input.intakeKey) {
    const existing = await getParentToyByIntakeKey(database, input.intakeKey);
    if (existing) return existing;
  }
  const validated = await validateToyInput(database, input);
  const managedImageUri = input.sourceImageUri
    ? await storage.copyIntoManagedStorage(input.sourceImageUri)
    : input.existingImageUri ?? null;
  let persisted = false;
  try {
    const toy = await createToy(database, { ...validated, imageUri: managedImageUri });
    persisted = true;
    const parentToy = await getParentToy(database, toy.id);
    if (!parentToy) throw new Error('Created toy could not be loaded.');
    void telemetry.track('toy_added');
    void trackLibraryScale(database);
    if (input.sourceImageUri) void telemetry.track('first_photo');
    return parentToy;
  } catch (error: unknown) {
    if (!persisted && input.sourceImageUri) await storage.deleteManagedImage(managedImageUri);
    throw error;
  }
}

export type BulkToyCreationResult = { created: ParentToy[]; failures: { id: string; index: number; message: string }[] };
export type BulkToyRecord = { id: string; input: Omit<ToyFormInput, 'sourceImageUri' | 'intakeKey'> & { sourceImageUri?: string | null } };

/** Creates every valid item independently so one bad photo never discards the rest of a family's intake. */
export async function createParentToysBulk(
  database: DatabaseConnection,
  records: readonly BulkToyRecord[],
  storage: ToyImageStorage = expoToyImageStorage,
): Promise<BulkToyCreationResult> {
  const created: ParentToy[] = [];
  const failures: BulkToyCreationResult['failures'] = [];
  for (const [index, record] of records.entries()) {
    try {
      created.push(await createParentToy(database, { ...record.input, sourceImageUri: record.input.sourceImageUri ?? null, intakeKey: record.id }, storage));
    } catch (caught: unknown) {
      failures.push({ id: record.id, index, message: caught instanceof Error ? caught.message : 'Could not save this photo.' });
    }
  }
  return { created, failures };
}

export async function updateParentToy(
  database: DatabaseConnection,
  id: number,
  input: ToyFormInput,
  storage: ToyImageStorage = expoToyImageStorage,
): Promise<ParentToy> {
  const existing = await getParentToy(database, id);
  if (!existing) throw new Error('Toy not found.');
  const validated = await validateToyInput(database, input);
  const copiedImageUri = input.sourceImageUri ? await storage.copyIntoManagedStorage(input.sourceImageUri) : null;
  const nextImageUri = copiedImageUri ?? (input.existingImageUri !== undefined ? input.existingImageUri : existing.imageUri);
  let persisted = false;
  try {
    const toy = await updateToy(database, id, { ...validated, imageUri: nextImageUri, isArchived: existing.isArchived });
    persisted = true;
    if (nextImageUri !== existing.imageUri) {
      const cleanupFailures = await deleteUniqueManagedImages(storage, [existing.originalImageUri, existing.enhancedImageUri, existing.imageUri].filter((uri) => uri !== copiedImageUri));
      if (cleanupFailures > 0) console.warn('Toy image cleanup incomplete after replacement or removal.');
    }
    const parentToy = await getParentToy(database, toy.id);
    if (!parentToy) throw new Error('Updated toy could not be loaded.');
    void telemetry.track('toy_edited');
    return parentToy;
  } catch (error: unknown) {
    if (copiedImageUri && !persisted) await storage.deleteManagedImage(copiedImageUri);
    throw error;
  }
}

export async function archiveParentToy(database: DatabaseConnection, id: number): Promise<void> {
  if (await countActivePlaySessionsForToy(database, id)) throw new Error('This toy is checked out. Finish that child’s cleanup before archiving it.');
  await setToyArchived(database, id, true);
}

export async function restoreParentToy(database: DatabaseConnection, id: number): Promise<void> {
  await setToyArchived(database, id, false);
}

export async function setParentToyAvailability(database: DatabaseConnection, id: number, available: boolean): Promise<void> {
  if (!available && await countActivePlaySessionsForToy(database, id)) throw new Error('This toy is checked out. Finish that child’s cleanup before hiding it.');
  await setToyAvailable(database, id, available);
}

/**
 * An existing toy with the same name, so intake can warn before adding a second
 * record for something already catalogued.
 *
 * This is a warning, not a block: two identical puzzles are a real thing to own,
 * and the parent is the one who knows which case they are in. Archived toys are
 * included, because "you already have one, it's archived" is the more useful
 * answer than silence.
 */
export async function findDuplicateToyByName(
  database: DatabaseConnection,
  name: string,
  excludeToyId?: number,
): Promise<ParentToy | null> {
  const wanted = name.trim().toLocaleLowerCase();
  if (!wanted) return null;
  const candidates = await listParentToys(database, { search: wanted, archived: 'all' });
  return candidates.find((toy) => toy.id !== excludeToyId && toy.name.trim().toLocaleLowerCase() === wanted) ?? null;
}

export type ToyDeletionImpact = {
  message: string;
  playSessionCount: number;
  toy: ParentToy;
};

export async function getToyDeletionImpact(database: DatabaseConnection, id: number): Promise<ToyDeletionImpact> {
  const toy = await getParentToy(database, id);
  if (!toy) throw new Error('Toy not found.');
  const playSessionCount = await countPlaySessionsForToy(database, id);
  const historyCopy = playSessionCount > 0
    ? ` ${playSessionCount} play ${playSessionCount === 1 ? 'history record' : 'history records'} will also be removed.`
    : ' There is no play history for this toy.';
  const photoCopy = toy.originalImageUri || toy.enhancedImageUri || toy.imageUri
    ? ' Its locally stored photo files will be deleted.'
    : ' It has no stored photo files.';
  return {
    message: `${toy.name} will be permanently removed.${historyCopy}${photoCopy} This cannot be undone.`,
    playSessionCount,
    toy,
  };
}

export async function permanentlyDeleteParentToy(
  database: DatabaseConnection,
  id: number,
  storage: ToyImageStorage = expoToyImageStorage,
): Promise<void> {
  const existing = await getParentToy(database, id);
  if (!existing) throw new Error('Toy not found.');
  if (await countActivePlaySessionsForToy(database, id)) throw new Error('This toy is checked out. Finish that child’s cleanup before deleting it.');
  await deleteToy(database, id);
  try {
    const cleanupFailures = await deleteUniqueManagedImages(storage, [existing.originalImageUri, existing.enhancedImageUri, existing.imageUri]);
    if (cleanupFailures > 0) console.warn('Toy image cleanup incomplete after deletion.');
  } catch {
    // Database deletion is authoritative; image cleanup can be retried by future maintenance.
  }
}
