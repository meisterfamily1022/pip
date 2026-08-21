import { LOCAL_HOUSEHOLD_ID, runMigrations } from '@/database/migrations';
import { RealSqliteConnection } from '@/database/real-sqlite-connection.test-helper';
import type { DatabaseConnection } from '@/database/types';

import { canOfferRestore, describeBackupStatus, loadBackupStatus, type BackupStatus } from './backup-status';

async function freshDatabase(): Promise<DatabaseConnection> {
  const database = new RealSqliteConnection();
  await runMigrations(database);
  return database;
}

async function addToy(database: DatabaseConnection): Promise<void> {
  await database.execAsync(`
    INSERT INTO rooms (id, name, household_id, created_at, updated_at) VALUES (1, 'Playroom', '${LOCAL_HOUSEHOLD_ID}', 'x', 'x');
    INSERT INTO storage_spots (id, room_id, name, household_id, created_at, updated_at) VALUES (1, 1, 'Bin', '${LOCAL_HOUSEHOLD_ID}', 'x', 'x');
    INSERT INTO toys (id, name, room_id, storage_spot_id, household_id, created_at, updated_at) VALUES (1, 'Tiles', 1, 1, '${LOCAL_HOUSEHOLD_ID}', 'x', 'x');
  `);
}

async function queue(database: DatabaseConnection, status: string, entityId: string): Promise<void> {
  await database.runAsync(
    `INSERT INTO sync_operations (entity, entity_id, household_id, status, attempts, created_at, updated_at)
     VALUES ('toy', ?, ?, ?, 0, 'x', 'x');`,
    entityId,
    LOCAL_HOUSEHOLD_ID,
    status,
  );
}

describe('backup status', () => {
  it('reports an untouched device honestly', async () => {
    const database = await freshDatabase();
    const status = await loadBackupStatus(database, LOCAL_HOUSEHOLD_ID);
    expect(status).toMatchObject({ linked: false, waiting: 0, failed: 0, sent: 0, hasLibrary: false });
    expect(describeBackupStatus(status)).toBe('There is nothing to back up yet. Add a toy first.');
  });

  it('does not call a library backed up merely because it has toys', async () => {
    const database = await freshDatabase();
    await addToy(database);
    const status = await loadBackupStatus(database, LOCAL_HOUSEHOLD_ID);
    expect(status.linked).toBe(false);
    expect(describeBackupStatus(status)).toBe('This library has never been backed up.');
  });

  it('counts work interrupted mid-record as still outstanding', async () => {
    const database = await freshDatabase();
    await addToy(database);
    await database.runAsync("UPDATE households SET remote_id = 'remote-1' WHERE id = ?;", LOCAL_HOUSEHOLD_ID);
    await queue(database, 'done', '1');
    await queue(database, 'pending', '2');
    await queue(database, 'in_flight', '3');

    const status = await loadBackupStatus(database, LOCAL_HOUSEHOLD_ID);
    expect(status).toMatchObject({ linked: true, sent: 1, waiting: 2, failed: 0 });
    expect(describeBackupStatus(status)).toBe('2 records still to upload. Pip will finish next time you tap Back up now.');
  });

  it('separates what the server refused from what is merely queued', async () => {
    const database = await freshDatabase();
    await addToy(database);
    await database.runAsync("UPDATE households SET remote_id = 'remote-1' WHERE id = ?;", LOCAL_HOUSEHOLD_ID);
    await queue(database, 'done', '1');
    await queue(database, 'failed', '2');

    const status = await loadBackupStatus(database, LOCAL_HOUSEHOLD_ID);
    expect(describeBackupStatus(status)).toBe('1 record backed up. 1 could not be sent and need another look.');
  });

  it('says everything is done only when nothing is outstanding', async () => {
    const database = await freshDatabase();
    await addToy(database);
    await database.runAsync("UPDATE households SET remote_id = 'remote-1' WHERE id = ?;", LOCAL_HOUSEHOLD_ID);
    await queue(database, 'done', '1');
    await queue(database, 'done', '2');

    expect(describeBackupStatus(await loadBackupStatus(database, LOCAL_HOUSEHOLD_ID)))
      .toBe('Everything is backed up — 2 records.');
  });

  it('offers restore only onto a device with no library of its own', () => {
    const base: BackupStatus = { linked: true, waiting: 0, failed: 0, sent: 0, lastBackupAt: null, hasLibrary: false };
    expect(canOfferRestore(base)).toBe(true);
    expect(canOfferRestore({ ...base, hasLibrary: true })).toBe(false);
  });
});
