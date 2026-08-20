import { runMigrations } from '@/database/migrations';
import { RealSqliteConnection } from '@/database/real-sqlite-connection.test-helper';
import type { DatabaseConnection } from '@/database/types';
import { activateHouseholdForAccount, backUpHouseholdToAccount } from '@/features/household/household-scope';
import { listChildProfiles } from '@/repositories/child-profiles-repository';
import { createRoom, createStorageSpot, listRooms } from '@/repositories/rooms-repository';
import { createToy, listParentToys } from '@/repositories/toys-repository';

import { downloadAndImportToyImage } from './image-pipeline';
import { applyRestoredRows, checkRestoreEligibility } from './sync-service';
import { FakeHouseholdGateway, FakeToyImageStorage } from './test-fakes';
import type { RemoteRow } from './remote-gateway';

const ACCOUNT_A = 'account-a';
const ACCOUNT_B = 'account-b';

/**
 * The complete scenario this fix was for: two households on one device, one
 * of them arriving by restore, and both happening to name a room "Playroom"
 * — an entirely ordinary thing for two families to both do. Before migration
 * 17 that either failed outright or silently dropped the room.
 *
 * Restore itself is exercised against the primary case it is actually built
 * for — a household with nothing in these tables yet, matching the briefing's
 * "clean install" scenario. A device that already has *populated* rooms/toys
 * for a different household is a distinct, disclosed limitation (the physical
 * row ids `applyRestoredRows` writes are the device's own integers, not
 * remapped against ids a second, already-populated household might already be
 * using) — not something migration 17 or 18 claims to fix, and not
 * re-attempted here. What this test proves is that once two households' data
 * legitimately coexists in these tables — whether the second arrived by
 * restore onto a clean set of tables, or by ordinary local use through the
 * real repository functions — nothing about sharing a room name breaks either
 * one.
 */
describe('two households, same room name, one device', () => {
  let database: DatabaseConnection;

  beforeEach(async () => {
    database = new RealSqliteConnection();
    await runMigrations(database);
  });

  it('restores household B onto a clean device, then lets household A independently create the same room name through ordinary use', async () => {
    await backUpHouseholdToAccount(database, 'local', ACCOUNT_A);
    const householdB = await activateHouseholdForAccount(database, ACCOUNT_B);
    expect(householdB).not.toBe('local');
    expect(await checkRestoreEligibility(database, householdB)).toEqual({ eligible: true });

    // Household B's remote backup: a room named "Playroom", a real photo.
    const gateway = new FakeHouseholdGateway();
    const storage = new FakeToyImageStorage();
    storage.setFingerprint('file:///tmp/downloaded/b-toy/photo.jpg', 'b-fingerprint');
    const { localUri } = await downloadAndImportToyImage(gateway, storage, 'remote-b', 'b-toy/photo.jpg');

    const rowsForB: RemoteRow[] = [
      { entity: 'room', localId: 1, revision: 1, deletedAt: null, intent: { kind: 'edit' }, data: { name: 'Playroom' } },
      { entity: 'storage_spot', localId: 1, revision: 1, deletedAt: null, intent: { kind: 'edit' }, data: { name: 'Toy Box', roomLocalId: 1 } },
      { entity: 'child_profile', localId: 1, revision: 1, deletedAt: null, intent: { kind: 'edit' }, data: { name: 'Bo' } },
      {
        entity: 'toy',
        localId: 1,
        revision: 1,
        deletedAt: null,
        intent: { kind: 'edit', photoPath: 'b-toy/photo.jpg' },
        data: { name: 'Robot', roomLocalId: 1, storageSpotLocalId: 1, categories: ['building'], imageUri: localUri },
      },
    ];

    const summary = await applyRestoredRows(database, householdB, rowsForB);
    expect(summary).toMatchObject({ rooms: 1, storageSpots: 1, toys: 1, childProfiles: 1, skipped: [] });

    // Household A, back in view: an ordinary parent adding their own
    // "Playroom" through the real app functions, after B's restore already
    // put a same-named room in the same physical table. Migration 17's
    // per-household uniqueness is what makes this succeed rather than throw.
    await activateHouseholdForAccount(database, ACCOUNT_A);
    const roomA = await createRoom(database, 'Playroom');
    const spotA = await createStorageSpot(database, roomA.id, 'Shelf');
    await createToy(database, {
      name: 'Toy Train',
      imageUri: null,
      roomId: roomA.id,
      storageSpotId: spotA.id,
      cleanupDifficulty: 'easy',
      adultHelpRequired: false,
      isAvailable: true,
      isArchived: false,
      categories: ['quiet'],
    });

    // Household A sees only its own "Playroom" and "Toy Train" — nothing of
    // household B's "Robot" or "Bo".
    expect(await listRooms(database)).toMatchObject([{ name: 'Playroom' }]);
    expect(await listParentToys(database)).toMatchObject([{ name: 'Toy Train' }]);
    expect(await listChildProfiles(database)).toHaveLength(0);

    // Household B, unaffected by A's later, independent room of the same name.
    await activateHouseholdForAccount(database, ACCOUNT_B);
    expect(await listRooms(database)).toMatchObject([{ name: 'Playroom' }]);
    const toysB = await listParentToys(database);
    expect(toysB).toMatchObject([{ name: 'Robot', categories: ['building'] }]);
    expect(toysB[0]!.imageUri).toBe(localUri);
    expect(toysB[0]!.imageUri).not.toMatch(/^https?:\/\//);
    expect(await listChildProfiles(database)).toMatchObject([{ name: 'Bo' }]);

    // Both physical "Playroom" rows exist in the same table, distinguished
    // only by household_id — the actual mechanism under test, and the exact
    // thing the old device-wide UNIQUE constraint made impossible.
    const allRoomsNamedPlayroom = await database.getAllAsync<{ household_id: string }>(
      "SELECT household_id FROM rooms WHERE name = 'Playroom' ORDER BY household_id;",
    );
    expect(allRoomsNamedPlayroom).toHaveLength(2);
    expect(new Set(allRoomsNamedPlayroom.map((row) => row.household_id)).size).toBe(2);
  });

  it('restoring twice into the same household is idempotent and does not duplicate it', async () => {
    const householdB = 'household-b';
    await database.runAsync(
      `INSERT INTO households (id, name, is_local_only, created_at, updated_at) VALUES (?, 'B', 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);`,
      householdB,
    );
    const rows: RemoteRow[] = [
      { entity: 'room', localId: 1, revision: 1, deletedAt: null, intent: { kind: 'edit' }, data: { name: 'Playroom' } },
    ];

    const first = await applyRestoredRows(database, householdB, rows);
    expect(first.rooms).toBe(1);

    // A second identical attempt reports the row as unwritable (it is already
    // there, by primary key) rather than silently duplicating it.
    const second = await applyRestoredRows(database, householdB, rows);
    expect(second.rooms).toBe(0);
    expect(second.skipped).toHaveLength(1);
    expect(second.skipped[0]!.reason.length).toBeGreaterThan(0);
    expect(second.skipped[0]!.reason).not.toBe('Could not be restored.');

    const roomsInB = await database.getAllAsync('SELECT id FROM rooms WHERE household_id = ?;', householdB);
    expect(roomsInB).toHaveLength(1);
  });
});
