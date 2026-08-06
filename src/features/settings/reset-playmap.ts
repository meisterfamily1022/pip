import type { DatabaseConnection } from '@/database/types';
import { deleteUniqueManagedImages, expoToyImageStorage, type ToyImageStorage } from '@/features/toys/toy-image-storage';
import { pinStorage, type PinStorage } from '@/services/pin-storage';

type StoredImageRow = {
  image_uri: string | null;
  original_image_uri: string | null;
  enhanced_image_uri: string | null;
};

export type ResetPlayMapResult = {
  imageCleanupFailures: number;
};

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

  const imageCleanupFailures = await deleteUniqueManagedImages(
    storage,
    [...toyImages, ...draftImages].flatMap((row) => [row.image_uri, row.original_image_uri, row.enhanced_image_uri]),
  );
  return { imageCleanupFailures };
}
