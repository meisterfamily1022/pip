import { LOCAL_HOUSEHOLD_ID, runMigrations } from '@/database/migrations';
import { RealSqliteConnection } from '@/database/real-sqlite-connection.test-helper';
import type { DatabaseConnection } from '@/database/types';
import {
  countToys,
  createToy,
  deleteToy,
  getParentToy,
  getToy,
  listChildToys,
  listParentToys,
  setToyArchived,
  setToyAvailable,
  updateToy,
} from '@/repositories/toys-repository';

import { listRooms, listStorageSpots, getRoom, roomNameExists } from '@/repositories/rooms-repository';
import { createChildProfile, listChildProfiles, getChildProfile } from '@/repositories/child-profiles-repository';
import { createPlaySession, hasEverPlayed, listActivePlaySessions } from '@/repositories/play-sessions-repository';

import { activateHouseholdForAccount, backUpHouseholdToAccount } from './household-scope';

/**
 * Isolation, against a real engine.
 *
 * The fake databases in the service tests match SQL as strings, so they prove a
 * filter was written but not that it filters. These run the actual statements
 * through SQLite with two households present, which is the only way to show
 * that one family's library is genuinely unreachable from the other's session.
 */

const PARENT_A = 'account-a';
const PARENT_B = 'account-b';

async function seedRoomAndSpot(database: DatabaseConnection, householdId: string): Promise<{ roomId: number; spotId: number }> {
  const room = await database.runAsync(
    'INSERT INTO rooms (name, created_at, updated_at, household_id) VALUES (?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, ?);',
    `Playroom ${householdId}`,
    householdId,
  );
  const spot = await database.runAsync(
    'INSERT INTO storage_spots (room_id, name, created_at, updated_at, household_id) VALUES (?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, ?);',
    room.lastInsertRowId,
    'Shelf',
    householdId,
  );
  return { roomId: room.lastInsertRowId, spotId: spot.lastInsertRowId };
}

async function addToy(database: DatabaseConnection, name: string): Promise<number> {
  const householdId = (await database.getFirstAsync<{ active_household_id: string }>(
    'SELECT active_household_id FROM device_household_state WHERE id = 1;',
  ))!.active_household_id;
  const { roomId, spotId } = await seedRoomAndSpot(database, householdId);
  const toy = await createToy(database, {
    name,
    imageUri: `file:///managed/${name}.jpg`,
    roomId,
    storageSpotId: spotId,
    cleanupDifficulty: 'easy',
    adultHelpRequired: false,
    isAvailable: true,
    isArchived: false,
    categories: ['building'],
  });
  return toy.id;
}

/** Parent A backs up their library; parent B signs in and gets a fresh one. */
async function twoHouseholds(): Promise<{ database: DatabaseConnection; toyOfA: number }> {
  const database = new RealSqliteConnection();
  await runMigrations(database);

  const toyOfA = await addToy(database, 'Wooden train');
  await backUpHouseholdToAccount(database, LOCAL_HOUSEHOLD_ID, PARENT_A);

  await activateHouseholdForAccount(database, PARENT_B);
  return { database, toyOfA };
}

describe('toy isolation between households', () => {
  it('creates toys into the household that is actually active', async () => {
    const database = new RealSqliteConnection();
    await runMigrations(database);
    await addToy(database, 'Wooden train');
    await backUpHouseholdToAccount(database, LOCAL_HOUSEHOLD_ID, PARENT_A);
    await activateHouseholdForAccount(database, PARENT_B);

    await addToy(database, 'Toy of B');

    const rows = await database.getAllAsync<{ name: string; household_id: string }>(
      'SELECT name, household_id FROM toys ORDER BY name;',
    );
    expect(rows).toHaveLength(2);
    expect(new Set(rows.map((row) => row.household_id)).size).toBe(2);
    // The regression that started this: household_id was never populated at all.
    expect(rows.every((row) => row.household_id !== null)).toBe(true);
  });

  it('hides another household\'s toys from every listing', async () => {
    const { database } = await twoHouseholds();

    expect(await listParentToys(database)).toHaveLength(0);
    expect(await listChildToys(database)).toHaveLength(0);
    expect(await countToys(database)).toBe(0);
  });

  it('will not fetch another household\'s toy by its id', async () => {
    const { database, toyOfA } = await twoHouseholds();

    expect(await getToy(database, toyOfA)).toBeNull();
    expect(await getParentToy(database, toyOfA)).toBeNull();
  });

  it('will not modify or delete another household\'s toy', async () => {
    const { database, toyOfA } = await twoHouseholds();

    await expect(setToyArchived(database, toyOfA, true)).rejects.toThrow('Toy not found.');
    await expect(setToyAvailable(database, toyOfA, false)).rejects.toThrow('Toy not found.');
    await expect(deleteToy(database, toyOfA)).rejects.toThrow('Toy not found.');
    await expect(
      updateToy(database, toyOfA, {
        name: 'Hijacked',
        imageUri: null,
        roomId: 1,
        storageSpotId: 1,
        cleanupDifficulty: 'easy',
        adultHelpRequired: false,
        isAvailable: true,
        isArchived: false,
        categories: ['building'],
      }),
    ).rejects.toThrow('Toy not found.');

    const survivor = await database.getFirstAsync<{ name: string }>('SELECT name FROM toys WHERE id = ?;', toyOfA);
    expect(survivor?.name).toBe('Wooden train');
  });

  it('gives the owner their library back when they sign in again', async () => {
    const { database, toyOfA } = await twoHouseholds();

    await activateHouseholdForAccount(database, PARENT_A);

    const toys = await listParentToys(database);
    expect(toys).toHaveLength(1);
    expect(toys[0]!.id).toBe(toyOfA);
  });

  it('leaves an owned library unreadable after sign out, without deleting it', async () => {
    const database = new RealSqliteConnection();
    await runMigrations(database);
    await addToy(database, 'Wooden train');
    await backUpHouseholdToAccount(database, LOCAL_HOUSEHOLD_ID, PARENT_A);

    await activateHouseholdForAccount(database, null);

    expect(await listParentToys(database)).toHaveLength(0);
    const stillThere = await database.getAllAsync<{ id: number }>('SELECT id FROM toys;');
    expect(stillThere).toHaveLength(1);
  });
});

describe('every other entity is scoped the same way', () => {
  it('hides rooms, spots and their names from another household', async () => {
    const database = new RealSqliteConnection();
    await runMigrations(database);
    await addToy(database, 'Wooden train');
    const roomsOfA = await listRooms(database);
    expect(roomsOfA).toHaveLength(1);

    await backUpHouseholdToAccount(database, LOCAL_HOUSEHOLD_ID, PARENT_A);
    await activateHouseholdForAccount(database, PARENT_B);

    expect(await listRooms(database)).toHaveLength(0);
    expect(await getRoom(database, roomsOfA[0]!.id)).toBeNull();
    expect(await listStorageSpots(database, roomsOfA[0]!.id)).toHaveLength(0);
    // Uniqueness must not leak the existence of the other family's rooms.
    expect(await roomNameExists(database, roomsOfA[0]!.name)).toBe(false);
  });

  it('hides child profiles from another household', async () => {
    const database = new RealSqliteConnection();
    await runMigrations(database);
    const child = await createChildProfile(database, 'Ari');
    await backUpHouseholdToAccount(database, LOCAL_HOUSEHOLD_ID, PARENT_A);
    await activateHouseholdForAccount(database, PARENT_B);

    expect(await listChildProfiles(database)).toHaveLength(0);
    expect(await getChildProfile(database, child.id)).toBeNull();

    // And a new child lands in B's household, not A's.
    await createChildProfile(database, 'Bo');
    const owners = await database.getAllAsync<{ household_id: string }>('SELECT household_id FROM child_profiles;');
    expect(new Set(owners.map((row) => row.household_id)).size).toBe(2);
  });

  it('hides play sessions from another household', async () => {
    const database = new RealSqliteConnection();
    await runMigrations(database);
    const toyId = await addToy(database, 'Wooden train');
    const child = await createChildProfile(database, 'Ari');
    await createPlaySession(database, child.id, toyId);
    expect(await listActivePlaySessions(database)).toHaveLength(1);

    await backUpHouseholdToAccount(database, LOCAL_HOUSEHOLD_ID, PARENT_A);
    await activateHouseholdForAccount(database, PARENT_B);

    expect(await listActivePlaySessions(database)).toHaveLength(0);
    expect(await hasEverPlayed(database)).toBe(false);
  });
});
