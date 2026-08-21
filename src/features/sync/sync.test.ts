import { LOCAL_HOUSEHOLD_ID, runMigrations } from '@/database/migrations';
import { RealSqliteConnection } from '@/database/real-sqlite-connection.test-helper';
import { ensureSettings } from '@/repositories/settings-repository';
import {
  checkConnectionEligibility,
  getImportProgress,
  isDeletedLocally,
  listSyncOperations,
  listTombstones,
  markOperation,
  planLibraryImport,
  recordDeletion,
  requeueInterrupted,
} from './library-connection';

/* -------------------------------------------------------------------------- */

type Fixture = { database: RealSqliteConnection; roomId: number; spotId: number };

async function setUp(): Promise<Fixture> {
  const database = new RealSqliteConnection();
  await runMigrations(database);
  await ensureSettings(database);
  await database.runAsync(
    "INSERT INTO rooms (name, household_id, created_at, updated_at) VALUES ('Playroom', ?, '2026-01-01', '2026-01-01');",
    LOCAL_HOUSEHOLD_ID,
  );
  const room = await database.getFirstAsync<{ id: number }>('SELECT id FROM rooms LIMIT 1;');
  await database.runAsync(
    "INSERT INTO storage_spots (room_id, name, household_id, created_at, updated_at) VALUES (?, 'Blue Bin', ?, '2026-01-01', '2026-01-01');",
    room!.id,
    LOCAL_HOUSEHOLD_ID,
  );
  const spot = await database.getFirstAsync<{ id: number }>('SELECT id FROM storage_spots LIMIT 1;');
  return { database, roomId: room!.id, spotId: spot!.id };
}

async function addToy(fixture: Fixture, name: string, isSample = false): Promise<number> {
  await fixture.database.runAsync(
    `INSERT INTO toys (name, room_id, storage_spot_id, household_id, is_sample, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, '2026-01-01', '2026-01-01');`,
    name,
    fixture.roomId,
    fixture.spotId,
    LOCAL_HOUSEHOLD_ID,
    isSample ? 1 : 0,
  );
  const row = await fixture.database.getFirstAsync<{ id: number }>('SELECT id FROM toys WHERE name = ?;', name);
  return row!.id;
}

const verifiedAccount = { accountId: 'acct_1', householdId: 'hh_1', emailVerified: true };

/**
 * Ids are per-table integers, so a room and a toy can both be id 1. Always
 * match on entity as well — which is exactly why sync_operations is keyed on
 * (entity, entity_id, household_id) rather than the id alone.
 */
const findOperation = <T extends { entity: string; entityId: string }>(
  operations: readonly T[],
  entity: string,
  id: number,
): T | undefined => operations.find((op) => op.entity === entity && op.entityId === String(id));

describe('connection eligibility', () => {
  let fixture: Fixture;

  beforeEach(async () => {
    fixture = await setUp();
  });

  afterEach(() => {
    fixture.database.close();
  });

  it('allows a verified account with a real library', async () => {
    await addToy(fixture, 'Blocks');
    expect(await checkConnectionEligibility(fixture.database, verifiedAccount)).toEqual({ eligible: true });
  });

  it('refuses without an account, and says why', async () => {
    await addToy(fixture, 'Blocks');
    const result = await checkConnectionEligibility(fixture.database, null);
    expect(result).toMatchObject({ eligible: false, reason: 'no-account' });
    if (!result.eligible) expect(result.message.length).toBeGreaterThan(0);
  });

  it('refuses until the email is confirmed', async () => {
    await addToy(fixture, 'Blocks');
    const result = await checkConnectionEligibility(fixture.database, { ...verifiedAccount, emailVerified: false });
    expect(result).toMatchObject({ eligible: false, reason: 'email-unverified' });
  });

  it('does not count sample toys as a library worth connecting', async () => {
    await addToy(fixture, 'Sample Blocks', true);
    expect(await checkConnectionEligibility(fixture.database, verifiedAccount)).toMatchObject({
      reason: 'nothing-to-connect',
    });
  });

  it('reports an already-connected library rather than connecting twice', async () => {
    await addToy(fixture, 'Blocks');
    await fixture.database.runAsync("UPDATE households SET remote_id = 'hh_1' WHERE id = ?;", LOCAL_HOUSEHOLD_ID);
    expect(await checkConnectionEligibility(fixture.database, verifiedAccount)).toMatchObject({
      reason: 'already-connected',
    });
  });

  it("refuses to move a library that belongs to someone else's account", async () => {
    await addToy(fixture, 'Blocks');
    await fixture.database.runAsync("UPDATE households SET remote_id = 'hh_other' WHERE id = ?;", LOCAL_HOUSEHOLD_ID);
    expect(await checkConnectionEligibility(fixture.database, verifiedAccount)).toMatchObject({
      reason: 'connected-elsewhere',
    });
  });
});

describe('import queue', () => {
  let fixture: Fixture;

  beforeEach(async () => {
    fixture = await setUp();
  });

  afterEach(() => {
    fixture.database.close();
  });

  it('queues every real record once', async () => {
    await addToy(fixture, 'Blocks');
    await addToy(fixture, 'Tiles');

    const queued = await planLibraryImport(fixture.database);

    // One room, one spot, two toys.
    expect(queued).toBe(4);
    const operations = await listSyncOperations(fixture.database);
    expect(operations.filter((op) => op.entity === 'toy')).toHaveLength(2);
    expect(operations.every((op) => op.status === 'pending')).toBe(true);
  });

  it('leaves sample rows out of a real household', async () => {
    await addToy(fixture, 'Real Blocks');
    await addToy(fixture, 'Sample Tiles', true);

    await planLibraryImport(fixture.database);

    const toys = (await listSyncOperations(fixture.database)).filter((op) => op.entity === 'toy');
    expect(toys).toHaveLength(1);
  });

  it('adds nothing on a second run, so a retry resumes instead of duplicating', async () => {
    await addToy(fixture, 'Blocks');
    const first = await planLibraryImport(fixture.database);

    expect(await planLibraryImport(fixture.database)).toBe(0);
    expect(await listSyncOperations(fixture.database)).toHaveLength(first);
  });

  it('does not re-queue a record that already finished', async () => {
    const toyId = await addToy(fixture, 'Blocks');
    await planLibraryImport(fixture.database);
    await markOperation(fixture.database, 'toy', String(toyId), { status: 'done' });

    await planLibraryImport(fixture.database);

    const operation = findOperation(await listSyncOperations(fixture.database), 'toy', toyId);
    expect(operation?.status).toBe('done');
  });

  it('queues records added after the first plan', async () => {
    await addToy(fixture, 'Blocks');
    await planLibraryImport(fixture.database);

    await addToy(fixture, 'Tiles');
    expect(await planLibraryImport(fixture.database)).toBe(1);
  });

  it('reports progress the parent can understand', async () => {
    const toyId = await addToy(fixture, 'Blocks');
    await planLibraryImport(fixture.database);
    await markOperation(fixture.database, 'toy', String(toyId), { status: 'done' });

    // One room, one storage spot, one toy.
    const progress = await getImportProgress(fixture.database);
    expect(progress.total).toBe(3);
    expect(progress.done).toBe(1);
    expect(progress.pending).toBe(2);
    expect(progress.conflicts).toBe(0);
    expect(progress.failed).toBe(0);
  });

  it('counts a failure and keeps the reason for the retry', async () => {
    const toyId = await addToy(fixture, 'Blocks');
    await planLibraryImport(fixture.database);

    await markOperation(fixture.database, 'toy', String(toyId), { status: 'failed', lastError: 'offline' });
    await markOperation(fixture.database, 'toy', String(toyId), { status: 'failed', lastError: 'offline' });

    const operation = findOperation(await listSyncOperations(fixture.database), 'toy', toyId);
    expect(operation).toMatchObject({ status: 'failed', attempts: 2, lastError: 'offline' });
  });

  it('returns interrupted uploads to the queue without touching finished ones', async () => {
    const stuck = await addToy(fixture, 'Stuck');
    const finished = await addToy(fixture, 'Finished');
    await planLibraryImport(fixture.database);
    await markOperation(fixture.database, 'toy', String(stuck), { status: 'in_flight' });
    await markOperation(fixture.database, 'toy', String(finished), { status: 'done' });

    // Stands in for a device that lost power mid-upload.
    expect(await requeueInterrupted(fixture.database)).toBe(1);

    const operations = await listSyncOperations(fixture.database);
    expect(findOperation(operations, 'toy', stuck)?.status).toBe('pending');
    expect(findOperation(operations, 'toy', finished)?.status).toBe('done');
  });

  it('keeps a conflict visible instead of silently applying an answer', async () => {
    const toyId = await addToy(fixture, 'Blocks');
    await planLibraryImport(fixture.database);
    await markOperation(fixture.database, 'toy', String(toyId), {
      status: 'conflict',
      conflictReason: 'photo-replaced',
    });

    const progress = await getImportProgress(fixture.database);
    expect(progress.conflicts).toBe(1);
    const operation = findOperation(await listSyncOperations(fixture.database), 'toy', toyId);
    expect(operation?.conflictReason).toBe('photo-replaced');
  });
});

describe('tombstones', () => {
  let fixture: Fixture;

  beforeEach(async () => {
    fixture = await setUp();
  });

  afterEach(() => {
    fixture.database.close();
  });

  it('records a deletion so another device cannot resurrect it', async () => {
    await recordDeletion(fixture.database, 'toy', '7');

    expect(await isDeletedLocally(fixture.database, 'toy', '7')).toBe(true);
    expect(await listTombstones(fixture.database)).toEqual([{ entity: 'toy', entityId: '7' }]);
  });

  it('treats a repeated deletion as harmless', async () => {
    await recordDeletion(fixture.database, 'toy', '7');
    await expect(recordDeletion(fixture.database, 'toy', '7')).resolves.toBeUndefined();
    expect(await listTombstones(fixture.database)).toHaveLength(1);
  });

  it('reports nothing for a record that was never deleted', async () => {
    expect(await isDeletedLocally(fixture.database, 'toy', '99')).toBe(false);
  });
});
