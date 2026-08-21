import { LOCAL_HOUSEHOLD_ID, runMigrations } from '@/database/migrations';
import { RealSqliteConnection } from '@/database/real-sqlite-connection.test-helper';
import type { DatabaseConnection } from '@/database/types';

import { backUpHousehold, BackupNotYoursError, isTransient, restoreHousehold } from './backup-service';
import type { RemoteHouseholdGateway } from './remote-gateway';
import { FakeHouseholdGateway, FakeToyImageStorage } from './test-fakes';

/**
 * Backup and restore end to end, against a real SQLite engine and the same
 * gateway contract the Supabase transport implements.
 *
 * The point of running the two halves against one another in the same test is
 * that a mismatch between what a push sends and what a restore reads is
 * exactly the class of bug a fake can hide — so here, everything that comes
 * back has to have gone out.
 */

async function freshDatabase(): Promise<DatabaseConnection> {
  const database = new RealSqliteConnection();
  await runMigrations(database);
  await database.runAsync("INSERT INTO settings (id, created_at, updated_at) VALUES (1, '2026-01-01', '2026-01-01');");
  return database;
}

/** A small but complete family library: two rooms, a spot, two toys, a child, a session. */
async function seedLibrary(database: DatabaseConnection): Promise<void> {
  const stamp = "'2026-01-01', '2026-01-01'";
  await database.execAsync(`
    INSERT INTO rooms (id, name, household_id, created_at, updated_at) VALUES
      (1, 'Playroom', '${LOCAL_HOUSEHOLD_ID}', ${stamp}),
      (2, 'Bedroom',  '${LOCAL_HOUSEHOLD_ID}', ${stamp});
    INSERT INTO storage_spots (id, room_id, name, household_id, created_at, updated_at) VALUES
      (1, 1, 'Blue Bin', '${LOCAL_HOUSEHOLD_ID}', ${stamp});
    INSERT INTO child_profiles (id, name, household_id, choice_limit, created_at, updated_at) VALUES
      (1, 'Maya', '${LOCAL_HOUSEHOLD_ID}', 5, ${stamp});
    INSERT INTO toys (id, name, image_uri, room_id, storage_spot_id, cleanup_difficulty, household_id, created_at, updated_at) VALUES
      (1, 'Magnetic Tiles', 'file:///photos/tiles.jpg', 1, 1, 'medium', '${LOCAL_HOUSEHOLD_ID}', ${stamp}),
      (2, 'Wooden Blocks',  NULL,                       1, 1, 'easy',   '${LOCAL_HOUSEHOLD_ID}', ${stamp});
    INSERT INTO toy_categories (toy_id, category, created_at) VALUES (1, 'building', '2026-01-01');
    INSERT INTO play_sessions (id, child_id, toy_id, status, started_at, completed_at, household_id, created_at, updated_at) VALUES
      (1, 1, 2, 'completed', '2026-01-01', '2026-01-02', '${LOCAL_HOUSEHOLD_ID}', ${stamp});
  `);
}


/**
 * The fake with one method replaced.
 *
 * Spreading the instance would drop everything on its prototype, so the
 * override is layered with Object.create and the original stays reachable
 * behind it.
 */
function gatewayWith(
  base: FakeHouseholdGateway,
  overrides: Partial<RemoteHouseholdGateway>,
): RemoteHouseholdGateway {
  return Object.assign(Object.create(base) as RemoteHouseholdGateway, overrides);
}

const deps = (database: DatabaseConnection, gateway: RemoteHouseholdGateway, storage: FakeToyImageStorage) =>
  ({ database, gateway, storage, householdId: LOCAL_HOUSEHOLD_ID });

describe('backing a household up', () => {
  it('sends every record once and uploads only the toys that have a photo', async () => {
    const database = await freshDatabase();
    await seedLibrary(database);
    const gateway = new FakeHouseholdGateway();
    const storage = new FakeToyImageStorage();

    const result = await backUpHousehold(deps(database, gateway, storage));

    // 2 rooms + 1 spot + 1 child + 2 toys + 1 session.
    expect(result.sent).toBe(7);
    expect(result.failures).toEqual([]);
    expect(result.photosUploaded).toBe(1);
    expect(gateway.uploadedImages.map((image) => image.localUri)).toEqual(['file:///photos/tiles.jpg']);
  });

  it('reports progress as it goes, so a long run is not a frozen screen', async () => {
    const database = await freshDatabase();
    await seedLibrary(database);
    const seen: number[] = [];

    await backUpHousehold({
      ...deps(database, new FakeHouseholdGateway(), new FakeToyImageStorage()),
      onProgress: ({ completed }) => seen.push(completed),
    });

    expect(seen).toEqual([1, 2, 3, 4, 5, 6, 7]);
  });

  it('is safe to run twice and does not resend what already went', async () => {
    const database = await freshDatabase();
    await seedLibrary(database);
    const gateway = new FakeHouseholdGateway();
    const storage = new FakeToyImageStorage();

    await backUpHousehold(deps(database, gateway, storage));
    const second = await backUpHousehold(deps(database, gateway, storage));

    expect(second.sent).toBe(0);
    expect(second.photosUploaded).toBe(0);
    expect(gateway.uploadedImages).toHaveLength(1);
  });

  it('leaves a record interrupted by the network queued, and finishes it on the next run', async () => {
    const database = await freshDatabase();
    await seedLibrary(database);
    const storage = new FakeToyImageStorage();
    const gateway = new FakeHouseholdGateway();

    let failuresLeft = 1;
    const flaky = gatewayWith(gateway, {
      writeRecord: (remote, entity, localId, revision, intent, data) => {
        if (entity === 'toy' && failuresLeft > 0) {
          failuresLeft -= 1;
          return Promise.reject(new Error('Network request failed'));
        }
        return gateway.writeRecord(remote, entity, localId, revision, intent, data);
      },
    });

    const first = await backUpHousehold(deps(database, flaky, storage));
    expect(first.failures).toHaveLength(1);
    expect(first.failures[0]).toMatchObject({ entity: 'toy' });

    // Still pending, never 'failed' — a lift is not a data problem.
    const queued = await database.getAllAsync<{ status: string }>(
      "SELECT status FROM sync_operations WHERE entity = 'toy' AND entity_id = '1' AND household_id = ?;",
      LOCAL_HOUSEHOLD_ID,
    );
    expect(queued[0].status).toBe('pending');

    const second = await backUpHousehold(deps(database, flaky, storage));
    expect(second.sent).toBe(1);
    expect(second.failures).toEqual([]);
  });

  it('marks a record the server actively rejected as failed, not as something to retry forever', async () => {
    const database = await freshDatabase();
    await seedLibrary(database);
    const gateway = new FakeHouseholdGateway();
    const rejecting = gatewayWith(gateway, {
      writeRecord: (remote, entity, localId, revision, intent, data) =>
        entity === 'room'
          ? Promise.reject(new Error('violates check constraint "rooms_name_check"'))
          : gateway.writeRecord(remote, entity, localId, revision, intent, data),
    });

    await backUpHousehold(deps(database, rejecting, new FakeToyImageStorage()));

    const rows = await database.getAllAsync<{ status: string; last_error: string }>(
      "SELECT status, last_error FROM sync_operations WHERE entity = 'room' AND household_id = ?;",
      LOCAL_HOUSEHOLD_ID,
    );
    expect(rows.every((row) => row.status === 'failed')).toBe(true);
    expect(rows[0].last_error).toMatch(/check constraint/);
  });

  it('tells a lift apart from a rejection', () => {
    expect(isTransient('Network request failed')).toBe(true);
    expect(isTransient('The connection timed out')).toBe(true);
    expect(isTransient('You appear to be offline')).toBe(true);
    expect(isTransient('violates check constraint')).toBe(false);
    expect(isTransient('duplicate key value')).toBe(false);
  });
});

describe('restoring onto a clean device', () => {
  async function backedUpLibrary(): Promise<{ gateway: FakeHouseholdGateway; storage: FakeToyImageStorage }> {
    const source = await freshDatabase();
    await seedLibrary(source);
    const gateway = new FakeHouseholdGateway();
    const storage = new FakeToyImageStorage();
    await backUpHousehold(deps(source, gateway, storage));
    return { gateway, storage };
  }

  it('brings back everything that was sent, with its photo imported locally', async () => {
    const { gateway, storage } = await backedUpLibrary();
    const device = await freshDatabase();

    const outcome = await restoreHousehold(deps(device, gateway, storage));

    expect(outcome.restored).toBe(true);
    if (!outcome.restored) return;
    expect(outcome.summary).toMatchObject({ rooms: 2, storageSpots: 1, toys: 2, childProfiles: 1, playSessions: 1 });
    expect(outcome.summary.skipped).toEqual([]);
    expect(outcome.photosRestored).toBe(1);
    expect(outcome.photosMissing).toBe(0);

    const toy = await device.getFirstAsync<{ name: string; image_uri: string; room_id: number; cleanup_difficulty: string }>(
      'SELECT name, image_uri, room_id, cleanup_difficulty FROM toys WHERE id = 1;',
    );
    expect(toy).toMatchObject({ name: 'Magnetic Tiles', room_id: 1, cleanup_difficulty: 'medium' });
    // A real local file, not a remote URL the app would depend on forever.
    expect(toy?.image_uri).toMatch(/^file:\/\/\/managed\//);

    const categories = await device.getAllAsync<{ category: string }>('SELECT category FROM toy_categories WHERE toy_id = 1;');
    expect(categories).toEqual([{ category: 'building' }]);

    const child = await device.getFirstAsync<{ name: string; choice_limit: number }>(
      'SELECT name, choice_limit FROM child_profiles WHERE id = 1;',
    );
    expect(child).toEqual({ name: 'Maya', choice_limit: 5 });
  });

  it('restores the library even when a photograph cannot be fetched, and says so', async () => {
    const { gateway, storage } = await backedUpLibrary();
    const device = await freshDatabase();
    const brokenPhotos = gatewayWith(gateway, {
      downloadImage: () => Promise.reject(new Error('Network request failed')),
    });

    const outcome = await restoreHousehold(deps(device, brokenPhotos, storage));

    expect(outcome.restored).toBe(true);
    if (!outcome.restored) return;
    expect(outcome.photosMissing).toBe(1);
    expect(outcome.summary.toys).toBe(2);
    const toy = await device.getFirstAsync<{ image_uri: string | null }>('SELECT image_uri FROM toys WHERE id = 1;');
    expect(toy?.image_uri).toBeNull();
  });

  it('refuses outright when the device already has toys of its own', async () => {
    const { gateway, storage } = await backedUpLibrary();
    const device = await freshDatabase();
    await seedLibrary(device);

    const outcome = await restoreHousehold(deps(device, gateway, storage));

    expect(outcome).toMatchObject({ restored: false, reason: expect.stringContaining('toys of its own') });
    expect(outcome).not.toMatchObject({ needsConfirmation: true });
  });

  it('asks before replacing what setup created, and replaces it once told to', async () => {
    const { gateway, storage } = await backedUpLibrary();
    const device = await freshDatabase();
    // Exactly what setup leaves behind: a room, a spot and a child, no toys.
    await device.execAsync(`
      INSERT INTO rooms (id, name, household_id, created_at, updated_at) VALUES (1, 'Setup Room', '${LOCAL_HOUSEHOLD_ID}', 'x', 'x');
      INSERT INTO storage_spots (id, room_id, name, household_id, created_at, updated_at) VALUES (1, 1, 'Setup Shelf', '${LOCAL_HOUSEHOLD_ID}', 'x', 'x');
      INSERT INTO child_profiles (id, name, household_id, created_at, updated_at) VALUES (1, 'Temp', '${LOCAL_HOUSEHOLD_ID}', 'x', 'x');
    `);

    const asked = await restoreHousehold(deps(device, gateway, storage));
    expect(asked).toMatchObject({ restored: false, needsConfirmation: true });
    // Nothing touched while the answer is still pending.
    expect(await device.getAllAsync('SELECT id FROM rooms;')).toHaveLength(1);

    const done = await restoreHousehold(deps(device, gateway, storage), { replaceSetup: true });
    expect(done.restored).toBe(true);
    if (!done.restored) return;
    expect(done.summary).toMatchObject({ rooms: 2, storageSpots: 1, toys: 2, childProfiles: 1 });

    const rooms = await device.getAllAsync<{ name: string }>('SELECT name FROM rooms ORDER BY name;');
    expect(rooms).toEqual([{ name: 'Bedroom' }, { name: 'Playroom' }]);
    const children = await device.getAllAsync<{ name: string }>('SELECT name FROM child_profiles;');
    expect(children).toEqual([{ name: 'Maya' }]);
  });

  it('says plainly when the account has no backup rather than reporting an empty success', async () => {
    const device = await freshDatabase();

    const outcome = await restoreHousehold(deps(device, new FakeHouseholdGateway(), new FakeToyImageStorage()));

    expect(outcome).toEqual({ restored: false, reason: 'There is no backup for this account yet.' });
  });
});

describe('a device linked to somebody else\'s account', () => {
  it('says so once, instead of failing every record separately', async () => {
    const database = await freshDatabase();
    await seedLibrary(database);
    const gateway = new FakeHouseholdGateway();
    // First run links the device and succeeds.
    await backUpHousehold(deps(database, gateway, new FakeToyImageStorage()));

    // The parent signs in as somebody else; the remote household is not theirs.
    gateway.owned = false;
    await database.runAsync("UPDATE sync_operations SET status = 'pending' WHERE household_id = ?;", LOCAL_HOUSEHOLD_ID);

    await expect(backUpHousehold(deps(database, gateway, new FakeToyImageStorage())))
      .rejects.toThrow(BackupNotYoursError);

    // And nothing was touched on the way to finding out.
    const rows = await database.getAllAsync<{ status: string }>(
      'SELECT status FROM sync_operations WHERE household_id = ?;',
      LOCAL_HOUSEHOLD_ID,
    );
    expect(rows.every((row) => row.status === 'pending')).toBe(true);
  });
});
