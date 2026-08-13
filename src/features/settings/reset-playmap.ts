import type { DatabaseConnection } from '@/database/types';
import { deleteUniqueManagedImages, expoToyImageStorage, type ToyImageStorage } from '@/features/toys/toy-image-storage';
import { pinStorage, type PinStorage } from '@/services/pin-storage';
import { onboardingProgressStorage } from '@/services/onboarding-progress-storage';
import { verifyParentPin } from '@/features/child/parent-access';

type StoredImageRow = {
  image_uri: string | null;
  original_image_uri: string | null;
  enhanced_image_uri: string | null;
};

export type ResetPlayMapResult = {
  imageCleanupFailures: number;
};

export type ResetImpact = {
  toys: number;
  photos: number;
  rooms: number;
  storageSpots: number;
  children: number;
  playRecords: number;
};

type CountRow = { count: number };

/** Counts the records a reset will irreversibly remove. */
export async function getResetImpact(database: DatabaseConnection): Promise<ResetImpact> {
  const [toys, photos, rooms, storageSpots, children, playRecords] = await Promise.all([
    database.getFirstAsync<CountRow>('SELECT COUNT(*) AS count FROM toys;'),
    database.getFirstAsync<CountRow>("SELECT COUNT(*) AS count FROM toys WHERE image_uri IS NOT NULL OR original_image_uri IS NOT NULL OR enhanced_image_uri IS NOT NULL;"),
    database.getFirstAsync<CountRow>('SELECT COUNT(*) AS count FROM rooms;'),
    database.getFirstAsync<CountRow>('SELECT COUNT(*) AS count FROM storage_spots;'),
    database.getFirstAsync<CountRow>('SELECT COUNT(*) AS count FROM child_profiles;'),
    database.getFirstAsync<CountRow>('SELECT COUNT(*) AS count FROM play_sessions;'),
  ]);
  return {
    toys: toys?.count ?? 0,
    photos: photos?.count ?? 0,
    rooms: rooms?.count ?? 0,
    storageSpots: storageSpots?.count ?? 0,
    children: children?.count ?? 0,
    playRecords: playRecords?.count ?? 0,
  };
}

/** PIN-gated reset entry point for user-facing destructive actions. */
export async function resetPlayMapDataWithPin(
  database: DatabaseConnection,
  enteredPin: string,
  storage: ToyImageStorage = expoToyImageStorage,
  pins: PinStorage = pinStorage,
): Promise<ResetPlayMapResult> {
  if (!(await verifyParentPin(pins, enteredPin))) throw new Error('That parent PIN does not match. Nothing was removed.');
  return resetPlayMapData(database, storage, pins);
}

/** Removes family data without deleting source files or the database itself. */
export async function resetPlayMapData(
  database: DatabaseConnection,
  storage: ToyImageStorage = expoToyImageStorage,
  pins: PinStorage = pinStorage,
): Promise<ResetPlayMapResult> {
  const [toyImages, draftImages] = await Promise.all([
    database.getAllAsync<StoredImageRow>('SELECT image_uri, original_image_uri, enhanced_image_uri FROM toys;'),
    database.getAllAsync<StoredImageRow>('SELECT NULL AS image_uri, original_image_uri, enhanced_image_uri FROM toy_setup_drafts;'),
  ]);
  const existingPin = await pins.getPin();
  // Clear secure storage first so a secure-storage failure cannot happen after
  // the database transaction has already committed. If the database fails,
  // restore the old PIN while SQLite rolls its transaction back.
  await pins.deletePin();
  try {
    await database.withTransactionAsync(async () => {
      await database.runAsync('DELETE FROM play_sessions;');
      await database.runAsync('DELETE FROM child_profiles;');
      await database.runAsync('DELETE FROM toy_categories;');
      await database.runAsync('DELETE FROM toy_setup_drafts;');
      await database.runAsync('DELETE FROM toys;');
      await database.runAsync('DELETE FROM storage_spots;');
      await database.runAsync('DELETE FROM rooms;');
      await database.runAsync(
        'UPDATE settings SET onboarding_completed = 0, child_nickname = NULL, active_child_id = NULL, choice_limit = 3, cleanup_required = 1, updated_at = ? WHERE id = 1;',
        new Date().toISOString(),
      );
    });
  } catch (error: unknown) {
    if (existingPin !== null) {
      try {
        await pins.savePin(existingPin);
      } catch {
        throw new Error('Pip data was preserved, but the parent PIN could not be restored. Restart the app before trying again.');
      }
    }
    throw error;
  }
  await onboardingProgressStorage.clear();

  const imageCleanupFailures = await deleteUniqueManagedImages(
    storage,
    [...toyImages, ...draftImages].flatMap((row) => [row.image_uri, row.original_image_uri, row.enhanced_image_uri]),
  );
  return { imageCleanupFailures };
}
