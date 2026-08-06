import type { DatabaseConnection } from '@/database/types';
import { pinStorage, type PinStorage } from '@/services/pin-storage';

export const REVIEW_FIXTURE_PIN = '2468';

export function assertReviewFixtureAllowed(isDevelopment: boolean = __DEV__): void {
  if (!isDevelopment) throw new Error('Review fixtures are disabled in production builds.');
}

/**
 * Deterministic, idempotent review data for local crawls and screenshots.
 * It is intentionally not connected to production UI.
 */
export async function seedReviewFixture(database: DatabaseConnection, pins: PinStorage = pinStorage): Promise<void> {
  assertReviewFixtureAllowed();
  const timestamp = new Date().toISOString();
  await database.withTransactionAsync(async () => {
    await database.runAsync('INSERT OR IGNORE INTO rooms (id, name, created_at, updated_at) VALUES (?, ?, ?, ?);', 910001, 'Review Playroom', timestamp, timestamp);
    await database.runAsync('INSERT OR IGNORE INTO rooms (id, name, created_at, updated_at) VALUES (?, ?, ?, ?);', 910002, 'Review Bedroom', timestamp, timestamp);
    await database.runAsync('INSERT OR IGNORE INTO storage_spots (id, room_id, name, created_at, updated_at) VALUES (?, ?, ?, ?, ?);', 910001, 910001, 'Mint Basket', timestamp, timestamp);
    await database.runAsync('INSERT OR IGNORE INTO storage_spots (id, room_id, name, created_at, updated_at) VALUES (?, ?, ?, ?, ?);', 910002, 910002, 'Low Shelf', timestamp, timestamp);

    const toys = [
      [910001, 'Review Blocks', 910001, 910001, 1, 0],
      [910002, 'Review Art Kit', 910001, 910001, 1, 0],
      [910003, 'Review Hidden Puzzle', 910002, 910002, 0, 0],
      [910004, 'Review Archived Puppet', 910002, 910002, 1, 1],
    ] as const;
    for (const [id, name, roomId, spotId, available, archived] of toys) {
      await database.runAsync(
        `INSERT INTO toys (id, name, image_uri, room_id, storage_spot_id, cleanup_difficulty, adult_help_required, is_available, is_archived, created_at, updated_at)
         VALUES (?, ?, NULL, ?, ?, 'easy', 0, ?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET name = excluded.name, room_id = excluded.room_id, storage_spot_id = excluded.storage_spot_id, is_available = excluded.is_available, is_archived = excluded.is_archived, updated_at = excluded.updated_at;`,
        id, name, roomId, spotId, available, archived, timestamp, timestamp,
      );
    }
    await database.runAsync('INSERT OR IGNORE INTO toy_categories (toy_id, category, created_at) VALUES (?, ?, ?);', 910001, 'building', timestamp);
    await database.runAsync('INSERT OR IGNORE INTO toy_categories (toy_id, category, created_at) VALUES (?, ?, ?);', 910002, 'creative', timestamp);
    await database.runAsync('INSERT OR IGNORE INTO toy_categories (toy_id, category, created_at) VALUES (?, ?, ?);', 910003, 'quiet', timestamp);
    await database.runAsync('INSERT OR IGNORE INTO toy_categories (toy_id, category, created_at) VALUES (?, ?, ?);', 910004, 'pretend', timestamp);
    await database.runAsync("UPDATE settings SET onboarding_completed = 1, child_nickname = 'Ari', choice_limit = 3, cleanup_required = 1, updated_at = ? WHERE id = 1;", timestamp);
  });
  await pins.savePin(REVIEW_FIXTURE_PIN);
}
