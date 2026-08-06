import { LOCAL_HOUSEHOLD_ID } from '@/database/migrations';
import type { DatabaseConnection } from '@/database/types';

/**
 * "Explore with sample toys".
 *
 * A parent evaluating Pip should not have to photograph a shelf first. This
 * seeds a small, obviously-fake library they can play with and then clear.
 *
 * Three properties matter, and each is tested:
 *
 * - **Unmistakable.** Every seeded row is named with a visible prefix, so a
 *   sample toy can never be mistaken for one of the family's own.
 * - **Isolated.** Rows carry `is_sample = 1`, so they can be removed wholesale
 *   and excluded from anything that must only see real data.
 * - **Idempotent.** Seeding twice adds nothing, so a double tap or a retry
 *   after a dropped connection cannot produce duplicates.
 */

/** Prefix shown to the parent. Also how seeded rows are recognised on removal. */
export const SAMPLE_PREFIX = 'Sample';

const sampleRooms = [
  {
    name: `${SAMPLE_PREFIX} Playroom`,
    spots: [`${SAMPLE_PREFIX} Blue Bin`, `${SAMPLE_PREFIX} Rainbow Shelf`],
  },
  {
    name: `${SAMPLE_PREFIX} Bedroom`,
    spots: [`${SAMPLE_PREFIX} Toy Chest`],
  },
] as const;

type SampleToy = {
  name: string;
  room: string;
  spot: string;
  categories: readonly string[];
};

const sampleToys: readonly SampleToy[] = [
  { name: `${SAMPLE_PREFIX} Wooden Blocks`, room: `${SAMPLE_PREFIX} Playroom`, spot: `${SAMPLE_PREFIX} Blue Bin`, categories: ['building', 'quiet'] },
  { name: `${SAMPLE_PREFIX} Magnetic Tiles`, room: `${SAMPLE_PREFIX} Playroom`, spot: `${SAMPLE_PREFIX} Blue Bin`, categories: ['building', 'creative'] },
  { name: `${SAMPLE_PREFIX} Dinosaur Figures`, room: `${SAMPLE_PREFIX} Playroom`, spot: `${SAMPLE_PREFIX} Rainbow Shelf`, categories: ['pretend'] },
  { name: `${SAMPLE_PREFIX} Picture Books`, room: `${SAMPLE_PREFIX} Bedroom`, spot: `${SAMPLE_PREFIX} Toy Chest`, categories: ['quiet', 'independent'] },
  { name: `${SAMPLE_PREFIX} Play Dough`, room: `${SAMPLE_PREFIX} Bedroom`, spot: `${SAMPLE_PREFIX} Toy Chest`, categories: ['creative', 'sensory'] },
  { name: `${SAMPLE_PREFIX} Soft Ball`, room: `${SAMPLE_PREFIX} Playroom`, spot: `${SAMPLE_PREFIX} Rainbow Shelf`, categories: ['active', 'together'] },
];

const now = (): string => new Date().toISOString();

export async function countSampleToys(database: DatabaseConnection): Promise<number> {
  const row = await database.getFirstAsync<{ count: number }>('SELECT COUNT(*) AS count FROM toys WHERE is_sample = 1;');
  return row?.count ?? 0;
}

export async function hasSampleLibrary(database: DatabaseConnection): Promise<boolean> {
  return (await countSampleToys(database)) > 0;
}

/**
 * Seeds the sample library.
 *
 * Returns how many toys were added; a second call returns 0 rather than
 * creating a second set.
 */
export async function seedSampleLibrary(
  database: DatabaseConnection,
  householdId: string = LOCAL_HOUSEHOLD_ID,
): Promise<number> {
  if (await hasSampleLibrary(database)) return 0;

  let added = 0;
  const timestamp = now();

  await database.withTransactionAsync(async () => {
    const roomIds = new Map<string, number>();
    const spotIds = new Map<string, number>();

    for (const room of sampleRooms) {
      const existing = await database.getFirstAsync<{ id: number }>(
        'SELECT id FROM rooms WHERE name = ? AND household_id = ?;',
        room.name,
        householdId,
      );
      const roomId =
        existing?.id ??
        (
          await database.runAsync(
            'INSERT INTO rooms (name, household_id, is_sample, created_at, updated_at) VALUES (?, ?, 1, ?, ?);',
            room.name,
            householdId,
            timestamp,
            timestamp,
          )
        ).lastInsertRowId;
      roomIds.set(room.name, roomId);

      for (const spot of room.spots) {
        const existingSpot = await database.getFirstAsync<{ id: number }>(
          'SELECT id FROM storage_spots WHERE name = ? AND room_id = ?;',
          spot,
          roomId,
        );
        const spotId =
          existingSpot?.id ??
          (
            await database.runAsync(
              'INSERT INTO storage_spots (room_id, name, household_id, is_sample, created_at, updated_at) VALUES (?, ?, ?, 1, ?, ?);',
              roomId,
              spot,
              householdId,
              timestamp,
              timestamp,
            )
          ).lastInsertRowId;
        spotIds.set(spot, spotId);
      }
    }

    for (const toy of sampleToys) {
      const roomId = roomIds.get(toy.room);
      const spotId = spotIds.get(toy.spot);
      if (roomId === undefined || spotId === undefined) continue;

      const result = await database.runAsync(
        `INSERT INTO toys (name, room_id, storage_spot_id, household_id, is_sample, created_at, updated_at)
         VALUES (?, ?, ?, ?, 1, ?, ?);`,
        toy.name,
        roomId,
        spotId,
        householdId,
        timestamp,
        timestamp,
      );
      added += 1;

      for (const category of toy.categories) {
        await database.runAsync(
          'INSERT OR IGNORE INTO toy_categories (toy_id, category, created_at) VALUES (?, ?, ?);',
          result.lastInsertRowId,
          category,
          timestamp,
        );
      }
    }
  });

  return added;
}

/**
 * Removes every sample row.
 *
 * Play sessions referencing a sample toy go first, because
 * `play_sessions.toy_id` is RESTRICT. Rooms and storage spots the parent
 * created themselves are never touched, since only flagged rows are removed.
 */
export async function removeSampleLibrary(database: DatabaseConnection): Promise<number> {
  let removed = 0;
  await database.withTransactionAsync(async () => {
    await database.runAsync('DELETE FROM play_sessions WHERE toy_id IN (SELECT id FROM toys WHERE is_sample = 1);');
    const toys = await database.runAsync('DELETE FROM toys WHERE is_sample = 1;');
    removed = toys.changes;
    await database.runAsync('DELETE FROM storage_spots WHERE is_sample = 1;');
    await database.runAsync('DELETE FROM rooms WHERE is_sample = 1;');
  });
  return removed;
}
