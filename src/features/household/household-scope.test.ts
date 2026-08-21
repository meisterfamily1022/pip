import { LOCAL_HOUSEHOLD_ID, runMigrations } from '@/database/migrations';
import { RealSqliteConnection } from '@/database/real-sqlite-connection.test-helper';
import type { DatabaseConnection } from '@/database/types';
import { getHousehold } from '@/repositories/households-repository';

import {
  activateHouseholdForAccount,
  backUpHouseholdToAccount,
  canAccountReadHousehold,
  DEVICE_LOCAL_ACCOUNT,
  findHouseholdForAccount,
  getActiveHouseholdId,
  HouseholdScopeError,
  clearRemoteLinkageAndSyncState,
} from './household-scope';

const PARENT_A = 'account-a';
const PARENT_B = 'account-b';

async function freshDatabase(): Promise<DatabaseConnection> {
  const database = new RealSqliteConnection();
  await runMigrations(database);
  return database;
}

/** A second household on the device, as a restore for another account would create. */
async function seedHouseholdOwnedBy(database: DatabaseConnection, id: string, accountId: string): Promise<void> {
  await database.runAsync(
    `INSERT INTO households (id, name, is_local_only, owner_account_id, created_at, updated_at)
     VALUES (?, 'Their Pip', 0, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);`,
    id,
    accountId,
  );
}

describe('household ownership', () => {
  it('starts device-local and unowned, so Pip works with no account at all', async () => {
    const database = await freshDatabase();

    expect(await getActiveHouseholdId(database)).toBe(LOCAL_HOUSEHOLD_ID);
    const household = await getHousehold(database, LOCAL_HOUSEHOLD_ID);
    expect(household?.ownerAccountId).toBeNull();
  });

  it('does not claim the local household merely because somebody signed in', async () => {
    const database = await freshDatabase();

    await activateHouseholdForAccount(database, PARENT_A);

    // Still the family's own device-local library, still unowned.
    expect(await getActiveHouseholdId(database)).toBe(LOCAL_HOUSEHOLD_ID);
    expect((await getHousehold(database, LOCAL_HOUSEHOLD_ID))?.ownerAccountId).toBeNull();
  });

  it('takes an explicit backup for a household to gain an owner', async () => {
    const database = await freshDatabase();

    const household = await backUpHouseholdToAccount(database, LOCAL_HOUSEHOLD_ID, PARENT_A);

    expect(household.ownerAccountId).toBe(PARENT_A);
    expect(household.isLocalOnly).toBe(false);
    expect(await getActiveHouseholdId(database)).toBe(LOCAL_HOUSEHOLD_ID);
  });

  it('never shows one parent the household another parent backed up', async () => {
    const database = await freshDatabase();
    await backUpHouseholdToAccount(database, LOCAL_HOUSEHOLD_ID, PARENT_A);

    // Parent A signs out, parent B signs in on the same phone.
    await activateHouseholdForAccount(database, DEVICE_LOCAL_ACCOUNT);
    const active = await activateHouseholdForAccount(database, PARENT_B);

    expect(active).not.toBe(LOCAL_HOUSEHOLD_ID);
    expect(await findHouseholdForAccount(database, PARENT_B)).toBeNull();
  });

  it('hides an owned household on sign out without deleting a single row', async () => {
    const database = await freshDatabase();
    await backUpHouseholdToAccount(database, LOCAL_HOUSEHOLD_ID, PARENT_A);

    await activateHouseholdForAccount(database, DEVICE_LOCAL_ACCOUNT);

    const household = await getHousehold(database, LOCAL_HOUSEHOLD_ID);
    expect(household?.ownerAccountId).toBe(PARENT_A);
    expect(canAccountReadHousehold(household!, DEVICE_LOCAL_ACCOUNT)).toBe(false);
    expect(canAccountReadHousehold(household!, PARENT_A)).toBe(true);
  });

  it('returns the owner to their own household when they sign back in', async () => {
    const database = await freshDatabase();
    await seedHouseholdOwnedBy(database, 'household-a', PARENT_A);

    await activateHouseholdForAccount(database, DEVICE_LOCAL_ACCOUNT);
    expect(await getActiveHouseholdId(database)).toBe(LOCAL_HOUSEHOLD_ID);

    expect(await activateHouseholdForAccount(database, PARENT_A)).toBe('household-a');
  });

  it('refuses to re-point a household that already belongs to somebody else', async () => {
    const database = await freshDatabase();
    await backUpHouseholdToAccount(database, LOCAL_HOUSEHOLD_ID, PARENT_A);

    await expect(backUpHouseholdToAccount(database, LOCAL_HOUSEHOLD_ID, PARENT_B)).rejects.toThrow(
      HouseholdScopeError,
    );
    expect((await getHousehold(database, LOCAL_HOUSEHOLD_ID))?.ownerAccountId).toBe(PARENT_A);
  });

  it('treats a retried backup confirmation as a no-op rather than a second household', async () => {
    const database = await freshDatabase();

    await backUpHouseholdToAccount(database, LOCAL_HOUSEHOLD_ID, PARENT_A);
    await backUpHouseholdToAccount(database, LOCAL_HOUSEHOLD_ID, PARENT_A);

    const rows = await database.getAllAsync<{ id: string }>(
      'SELECT id FROM households WHERE owner_account_id = ?;',
      PARENT_A,
    );
    expect(rows).toHaveLength(1);
  });

  it('will not give one account two libraries on the same device', async () => {
    const database = await freshDatabase();
    await seedHouseholdOwnedBy(database, 'household-a', PARENT_A);

    await expect(backUpHouseholdToAccount(database, LOCAL_HOUSEHOLD_ID, PARENT_A)).rejects.toThrow(
      HouseholdScopeError,
    );
  });

  it('keeps the active household across a relaunch, with no session to consult', async () => {
    const database = await freshDatabase();
    await seedHouseholdOwnedBy(database, 'household-a', PARENT_A);
    await activateHouseholdForAccount(database, PARENT_A);

    // Relaunch: migrations run again against the same database, nothing else.
    await runMigrations(database);

    expect(await getActiveHouseholdId(database)).toBe('household-a');
  });
});

describe('household migrations', () => {
  it('adopts rows the old inserts left without a household, so nothing vanishes', async () => {
    const database = new RealSqliteConnection();
    await runMigrations(database, 13);
    // How createToy wrote rows between migrations 9 and 14: no household at all.
    await database.runAsync(
      `INSERT INTO rooms (name, created_at, updated_at) VALUES ('Playroom', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);`,
    );
    await database.runAsync(
      `INSERT INTO storage_spots (room_id, name, created_at, updated_at) VALUES (1, 'Shelf', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);`,
    );
    await database.runAsync(
      `INSERT INTO toys (name, image_uri, room_id, storage_spot_id, is_available, is_archived, created_at, updated_at)
       VALUES ('Wooden train', NULL, 1, 1, 1, 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);`,
    );

    await runMigrations(database);

    const orphans = await database.getAllAsync<{ name: string }>(
      'SELECT name FROM toys WHERE household_id IS NULL UNION ALL SELECT name FROM rooms WHERE household_id IS NULL;',
    );
    expect(orphans).toHaveLength(0);
    const toys = await database.getAllAsync<{ household_id: string }>('SELECT household_id FROM toys;');
    expect(toys[0]!.household_id).toBe(LOCAL_HOUSEHOLD_ID);
  });

  it('repairs a device that already took migration 14 before the backfill existed', async () => {
    const database = new RealSqliteConnection();
    await runMigrations(database, 14);
    await database.runAsync(
      `INSERT INTO rooms (name, created_at, updated_at) VALUES ('Playroom', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);`,
    );
    await database.runAsync(
      `INSERT INTO storage_spots (room_id, name, created_at, updated_at) VALUES (1, 'Shelf', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);`,
    );
    await database.runAsync(
      `INSERT INTO toys (name, image_uri, room_id, storage_spot_id, is_available, is_archived, created_at, updated_at)
       VALUES ('Orphan', NULL, 1, 1, 1, 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);`,
    );

    await runMigrations(database);

    const toys = await database.getAllAsync<{ household_id: string | null }>('SELECT household_id FROM toys;');
    expect(toys.every((row) => row.household_id === LOCAL_HOUSEHOLD_ID)).toBe(true);
  });

  it('is idempotent and leaves existing libraries device-local', async () => {
    const database = new RealSqliteConnection();
    await runMigrations(database, 13);
    await database.runAsync(
      `INSERT INTO rooms (name, created_at, updated_at, household_id) VALUES ('Playroom', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, ?);`,
      LOCAL_HOUSEHOLD_ID,
    );

    await runMigrations(database);
    await runMigrations(database);

    expect((await getHousehold(database, LOCAL_HOUSEHOLD_ID))?.ownerAccountId).toBeNull();
    expect(await getActiveHouseholdId(database)).toBe(LOCAL_HOUSEHOLD_ID);
    const rooms = await database.getAllAsync<{ name: string }>('SELECT name FROM rooms;');
    expect(rooms).toHaveLength(1);
  });
});

describe('clearing a device after the account behind it was deleted', () => {
  /** A household mid-backup: linked to a remote, with a cursor and queued work. */
  async function seedBackedUpHousehold(database: DatabaseConnection): Promise<void> {
    await database.runAsync(
      `UPDATE households
          SET owner_account_id = ?, remote_id = 'remote-household-1', is_local_only = 0
        WHERE id = ?;`,
      PARENT_A,
      LOCAL_HOUSEHOLD_ID,
    );
    await database.runAsync(
      "INSERT INTO household_sync_state (household_id, last_synced_revision, updated_at) VALUES (?, 4200, CURRENT_TIMESTAMP);",
      LOCAL_HOUSEHOLD_ID,
    );
    await database.runAsync(
      `INSERT INTO sync_operations (entity, entity_id, household_id, status, attempts, created_at, updated_at)
       VALUES ('toy', '7', ?, 'pending', 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);`,
      LOCAL_HOUSEHOLD_ID,
    );
    await database.runAsync(
      "INSERT INTO deleted_records (entity, entity_id, household_id, deleted_at) VALUES ('toy', '9', ?, CURRENT_TIMESTAMP);",
      LOCAL_HOUSEHOLD_ID,
    );
  }

  it('removes every trace of the deleted remote household', async () => {
    const database = await freshDatabase();
    await seedBackedUpHousehold(database);

    expect(await clearRemoteLinkageAndSyncState(database, LOCAL_HOUSEHOLD_ID, PARENT_A)).toBe(true);

    const household = await getHousehold(database, LOCAL_HOUSEHOLD_ID);
    expect(household?.ownerAccountId).toBeNull();
    expect(household?.remoteId).toBeNull();
    expect(household?.isLocalOnly).toBe(true);

    for (const table of ['household_sync_state', 'sync_operations', 'deleted_records']) {
      const rows = await database.getAllAsync<{ count: number }>(
        `SELECT COUNT(*) AS count FROM "${table}" WHERE household_id = ?;`,
        LOCAL_HOUSEHOLD_ID,
      );
      expect({ table, count: rows[0].count }).toEqual({ table, count: 0 });
    }
  });

  it('leaves the family library alone, because deleting a login is not deleting toys', async () => {
    const database = await freshDatabase();
    await seedBackedUpHousehold(database);
    await database.runAsync(
      "INSERT INTO rooms (name, household_id, created_at, updated_at) VALUES ('Playroom', ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);",
      LOCAL_HOUSEHOLD_ID,
    );

    await clearRemoteLinkageAndSyncState(database, LOCAL_HOUSEHOLD_ID, PARENT_A);

    const rooms = await database.getAllAsync<{ name: string }>('SELECT name FROM rooms;');
    expect(rooms).toEqual([{ name: 'Playroom' }]);
  });

  it('refuses to unlink a household owned by somebody else, and keeps their queue intact', async () => {
    const database = await freshDatabase();
    await seedBackedUpHousehold(database);

    expect(await clearRemoteLinkageAndSyncState(database, LOCAL_HOUSEHOLD_ID, PARENT_B)).toBe(false);

    const household = await getHousehold(database, LOCAL_HOUSEHOLD_ID);
    expect(household?.ownerAccountId).toBe(PARENT_A);
    const queued = await database.getAllAsync<{ count: number }>('SELECT COUNT(*) AS count FROM sync_operations;');
    expect(queued[0].count).toBe(1);
  });
});
