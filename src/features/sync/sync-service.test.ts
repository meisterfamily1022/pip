import { LOCAL_HOUSEHOLD_ID, runMigrations } from '@/database/migrations';
import { RealSqliteConnection } from '@/database/real-sqlite-connection.test-helper';
import type { DatabaseConnection } from '@/database/types';
import { listParentToys } from '@/repositories/toys-repository';
import { listRooms } from '@/repositories/rooms-repository';
import { listChildProfiles } from '@/repositories/child-profiles-repository';

import { SyncContentionError, acknowledgeRecoveryEvent, applyRestoredRows, checkRestoreEligibility, ensureRemoteHousehold, getSyncedRevision, listUnacknowledgedRecoveryEvents, markSyncedRevision, pullChanges, pushRecord, recordRecoveryEvent } from './sync-service';
import { downloadAndImportToyImage } from './image-pipeline';
import { FakeHouseholdGateway, FakeToyImageStorage } from './test-fakes';
import type { RemoteRow } from './remote-gateway';

// The device's own household, already seeded by migrations and already the
// one `device_household_state` marks active — which is what the scoped
// repositories (listRooms, listChildProfiles, listParentToys) read from.
// Using a household these helpers do not otherwise recognise would make every
// assertion against them silently see zero rows for reasons unrelated to what
// is under test.
const HOUSEHOLD = LOCAL_HOUSEHOLD_ID;

async function freshDatabase(): Promise<DatabaseConnection> {
  const database = new RealSqliteConnection();
  await runMigrations(database);
  return database;
}

describe('pushRecord — the happy path', () => {
  it('applies a brand-new record with no prior revision', async () => {
    const gateway = new FakeHouseholdGateway();
    const result = await pushRecord(gateway, 'remote-1', 'room', 1, null, { kind: 'edit' });
    expect(result).toEqual({ outcome: 'applied', revision: 1 });
  });

  it('applies an update given the revision it was last synced at', async () => {
    const gateway = new FakeHouseholdGateway();
    const first = await pushRecord(gateway, 'remote-1', 'room', 1, null, { kind: 'edit' });
    const second = await pushRecord(gateway, 'remote-1', 'room', 1, first.revision, { kind: 'edit' });
    expect(second.outcome).toBe('applied');
    expect(second.revision).toBeGreaterThan(first.revision);
  });
});

describe('offline edit and delete — rule 2a', () => {
  it('archives the edit and keeps the deletion when the server already deleted it', async () => {
    const gateway = new FakeHouseholdGateway();
    const created = await pushRecord(gateway, 'remote-1', 'toy', 5, null, { kind: 'edit', photoPath: 'a.jpg' });
    // The server's copy is deleted by "another device" without this one knowing.
    await pushRecord(gateway, 'remote-1', 'toy', 5, created.revision, { kind: 'delete' });

    // This device, offline the whole time, believes it is still at `created`'s
    // revision and tries to push an edit made before it ever saw the delete.
    const result = await pushRecord(gateway, 'remote-1', 'toy', 5, created.revision, { kind: 'edit', photoPath: 'b.jpg' });

    expect(result).toMatchObject({ outcome: 'recovered', reason: 'edited-and-deleted' });
    expect(gateway.archivedConflicts).toContainEqual(
      expect.objectContaining({ entity: 'toy', localId: 5, reason: 'edited-and-deleted', archived: { kind: 'edit', photoPath: 'b.jpg' } }),
    );
    // The toy stays deleted — a family that removed a toy must not watch it
    // reappear because a different device had a stale edit queued.
    const current = await gateway.fetchChangesSince('remote-1', 0);
    expect(current.find((row) => row.localId === 5)?.deletedAt).not.toBeNull();
  });

  it('archives the server-held edit and applies the incoming delete', async () => {
    const gateway = new FakeHouseholdGateway();
    const created = await pushRecord(gateway, 'remote-1', 'toy', 6, null, { kind: 'edit', photoPath: 'a.jpg' });
    // Another device edited it after this device last synced.
    const edited = await pushRecord(gateway, 'remote-1', 'toy', 6, created.revision, { kind: 'edit', photoPath: 'newer.jpg' });

    // This device deletes the toy, unaware of the newer edit.
    const result = await pushRecord(gateway, 'remote-1', 'toy', 6, created.revision, { kind: 'delete' });

    expect(result).toMatchObject({ outcome: 'recovered', reason: 'edited-and-deleted' });
    expect(gateway.archivedConflicts[0]?.archived).toEqual({ kind: 'edit', photoPath: 'newer.jpg' });
    void edited;
  });
});

describe('photo replaced on both sides — rule 2b', () => {
  it('keeps the incoming photo current and archives the other, never deleting it', async () => {
    const gateway = new FakeHouseholdGateway();
    const created = await pushRecord(gateway, 'remote-1', 'toy', 9, null, { kind: 'edit', photoPath: 'original.jpg' });
    // Another device replaced the photo first.
    await pushRecord(gateway, 'remote-1', 'toy', 9, created.revision, { kind: 'edit', photoPath: 'from-other-device.jpg' });

    const result = await pushRecord(gateway, 'remote-1', 'toy', 9, created.revision, { kind: 'edit', photoPath: 'from-this-device.jpg' });

    expect(result).toMatchObject({ outcome: 'recovered', reason: 'photo-replaced' });
    expect(gateway.archivedImages).toHaveLength(0); // archiveImagePath is a separate call the orchestrator makes; see image-pipeline integration below.
    expect(gateway.archivedConflicts[0]).toMatchObject({ reason: 'photo-replaced', archived: { kind: 'edit', photoPath: 'from-other-device.jpg' } });
    const current = await gateway.fetchChangesSince('remote-1', 0);
    expect(current.find((row) => row.localId === 9)?.data.imageUri).toBe('from-this-device.jpg');
    // The losing photo was never deleted anywhere — nothing in this fake calls
    // delete, and the archived record preserves its path for recovery.
    expect(gateway.deletedImages).toHaveLength(0);
  });
});

describe('competing active sessions — rule 2c', () => {
  it('keeps the incoming session active and archives the other as closed', async () => {
    const gateway = new FakeHouseholdGateway();
    const created = await pushRecord(gateway, 'remote-1', 'play_session', 3, null, { kind: 'edit', sessionActive: true });
    // A second device also starts a session for the same child before syncing.
    await pushRecord(gateway, 'remote-1', 'play_session', 3, created.revision, { kind: 'edit', sessionActive: true });

    const result = await pushRecord(gateway, 'remote-1', 'play_session', 3, created.revision, { kind: 'edit', sessionActive: true });

    expect(result).toMatchObject({ outcome: 'recovered', reason: 'competing-active-sessions' });
    expect(gateway.archivedConflicts[0]?.reason).toBe('competing-active-sessions');
  });
});

describe('replay — a retried push after an interruption is idempotent', () => {
  it('does not create a second record or a spurious conflict when retried with the same revision it already applied at', async () => {
    const gateway = new FakeHouseholdGateway();
    const first = await pushRecord(gateway, 'remote-1', 'room', 2, null, { kind: 'edit' });

    // The device crashed believing the write might not have gone through, and
    // retries with the *same* expected revision it had before the write.
    const retried = await pushRecord(gateway, 'remote-1', 'room', 2, null, { kind: 'edit' });

    // The retry is correctly treated as a conflict against the row it already
    // wrote (not a duplicate) and resolves as an ordinary superseding edit —
    // exactly once, no archive, no duplicate row.
    expect(retried.outcome).toBe('applied');
    expect(gateway.archivedConflicts).toHaveLength(0);
    const rows = await gateway.fetchChangesSince('remote-1', 0);
    expect(rows.filter((row) => row.entity === 'room' && row.localId === 2)).toHaveLength(1);
    void first;
  });

  it('gives up rather than loop forever under pathological contention', async () => {
    const gateway = new FakeHouseholdGateway();
    await pushRecord(gateway, 'remote-1', 'room', 42, null, { kind: 'edit' });

    // A hostile network: something else bumps the row's revision directly
    // before every single attempt, so no expected revision this call passes
    // can ever be current — a worst case that must still terminate.
    const original = gateway.writeRecord.bind(gateway);
    gateway.writeRecord = async (...args) => {
      const current = gateway.rows.get('room:42')!;
      gateway.rows.set('room:42', { ...current, revision: current.revision + 1 });
      return original(...args);
    };

    await expect(pushRecord(gateway, 'remote-1', 'room', 42, 1, { kind: 'edit' })).rejects.toThrow(SyncContentionError);
  });
});

describe('clock skew has no influence', () => {
  it('produces the same outcome regardless of which "device" has the later real-world clock', async () => {
    // Device A's clock is set five years fast; device B's is accurate. Neither
    // clock is ever read by pushRecord — there is no timestamp parameter to
    // pass one to. The outcome can only depend on server arrival order.
    const gatewayA = new FakeHouseholdGateway();
    const createdA = await pushRecord(gatewayA, 'remote-1', 'room', 1, null, { kind: 'edit' });
    await pushRecord(gatewayA, 'remote-1', 'room', 1, createdA.revision, { kind: 'edit' }); // "other device" writes first
    const resultA = await pushRecord(gatewayA, 'remote-1', 'room', 1, createdA.revision, { kind: 'edit' });

    const gatewayB = new FakeHouseholdGateway();
    const createdB = await pushRecord(gatewayB, 'remote-1', 'room', 1, null, { kind: 'edit' });
    await pushRecord(gatewayB, 'remote-1', 'room', 1, createdB.revision, { kind: 'edit' });
    const resultB = await pushRecord(gatewayB, 'remote-1', 'room', 1, createdB.revision, { kind: 'edit' });

    expect(resultA.outcome).toBe(resultB.outcome);
  });
});

describe('pullChanges', () => {
  it('returns only rows newer than the given revision, and the new high-water mark', async () => {
    const gateway = new FakeHouseholdGateway();
    const first = await pushRecord(gateway, 'remote-1', 'room', 1, null, { kind: 'edit' });
    const second = await pushRecord(gateway, 'remote-1', 'room', 2, null, { kind: 'edit' });

    const { rows, latestRevision } = await pullChanges(gateway, 'remote-1', first.revision);

    expect(rows).toHaveLength(1);
    expect(rows[0]?.localId).toBe(2);
    expect(latestRevision).toBe(second.revision);
  });

  it('returns nothing new and the same high-water mark when there is nothing to pull', async () => {
    const gateway = new FakeHouseholdGateway();
    const created = await pushRecord(gateway, 'remote-1', 'room', 1, null, { kind: 'edit' });
    const { rows, latestRevision } = await pullChanges(gateway, 'remote-1', created.revision);
    expect(rows).toHaveLength(0);
    expect(latestRevision).toBe(created.revision);
  });
});

describe('restore eligibility', () => {
  it('allows restoring into an empty household', async () => {
    const database = await freshDatabase();
    expect(await checkRestoreEligibility(database, HOUSEHOLD)).toEqual({ eligible: true });
  });

  it('refuses to restore into a household that already has toys, to avoid an id collision', async () => {
    const database = await freshDatabase();
    await database.runAsync(
      `INSERT INTO rooms (id, name, household_id, created_at, updated_at) VALUES (1, 'Playroom', ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);`,
      HOUSEHOLD,
    );
    await database.runAsync(
      `INSERT INTO storage_spots (id, room_id, name, household_id, created_at, updated_at) VALUES (1, 1, 'Shelf', ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);`,
      HOUSEHOLD,
    );
    await database.runAsync(
      `INSERT INTO toys (id, name, room_id, storage_spot_id, household_id, created_at, updated_at) VALUES (1, 'Existing', 1, 1, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);`,
      HOUSEHOLD,
    );

    const result = await checkRestoreEligibility(database, HOUSEHOLD);
    expect(result).toMatchObject({ eligible: false, reason: 'not-empty' });
  });
});

describe('restore', () => {
  const row = (overrides: Partial<RemoteRow>): RemoteRow => ({
    entity: 'room',
    localId: 1,
    revision: 1,
    deletedAt: null,
    intent: { kind: 'edit' },
    data: {},
    ...overrides,
  });

  it('restores every entity kind and reports the actual counts', async () => {
    const database = await freshDatabase();
    const rows: RemoteRow[] = [
      row({ entity: 'room', localId: 1, data: { name: 'Playroom' } }),
      row({ entity: 'storage_spot', localId: 1, data: { name: 'Shelf', roomLocalId: 1 } }),
      row({ entity: 'child_profile', localId: 1, data: { name: 'Ari' } }),
      row({ entity: 'toy', localId: 1, data: { name: 'Blocks', roomLocalId: 1, storageSpotLocalId: 1, categories: ['building'] } }),
      row({ entity: 'play_session', localId: 1, data: { childLocalId: 1, toyLocalId: 1, status: 'active', startedAt: '2026-01-01T00:00:00.000Z' } }),
    ];

    const summary = await applyRestoredRows(database, HOUSEHOLD, rows);

    expect(summary).toMatchObject({ rooms: 1, storageSpots: 1, toys: 1, childProfiles: 1, playSessions: 1, skipped: [] });
    expect(await listRooms(database)).toHaveLength(1);
    expect(await listChildProfiles(database)).toHaveLength(1);
    const toys = await listParentToys(database);
    expect(toys).toMatchObject([{ name: 'Blocks', categories: ['building'] }]);
  });

  it('skips a tombstoned row rather than restoring something the family deleted', async () => {
    const database = await freshDatabase();
    const rows: RemoteRow[] = [row({ deletedAt: '2026-01-01T00:00:00.000Z', data: { name: 'Deleted room' } })];

    const summary = await applyRestoredRows(database, HOUSEHOLD, rows);

    expect(summary.rooms).toBe(0);
    expect(await listRooms(database)).toHaveLength(0);
  });

  it('reports a colliding room by name as an actionable skip rather than aborting the whole restore', async () => {
    const database = await freshDatabase();
    // A different household on this device already has a room named "Playroom" —
    // the pre-existing global uniqueness on rooms.name (see the sync report)
    // collides. Restore must not silently lose the rest of the library over it.
    await database.runAsync(
      `INSERT INTO households (id, name, is_local_only, created_at, updated_at) VALUES ('some-other-household', 'Other', 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);`,
    );
    await database.runAsync(
      `INSERT INTO rooms (id, name, household_id, created_at, updated_at) VALUES (999, 'Playroom', 'some-other-household', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);`,
    );
    const rows: RemoteRow[] = [
      row({ entity: 'room', localId: 1, data: { name: 'Playroom' } }),
      row({ entity: 'child_profile', localId: 1, data: { name: 'Ari' } }),
    ];

    const summary = await applyRestoredRows(database, HOUSEHOLD, rows);

    expect(summary.rooms).toBe(0);
    expect(summary.skipped).toContainEqual(expect.objectContaining({ entity: 'room', localId: 1 }));
    // The rest of the restore proceeded — one bad row did not take the family's
    // children down with it.
    expect(summary.childProfiles).toBe(1);
  });

  it('lands a play session marked interrupted as completed, since the local schema has no such status', async () => {
    const database = await freshDatabase();
    const rows: RemoteRow[] = [
      row({ entity: 'child_profile', localId: 1, data: { name: 'Ari' } }),
      row({ entity: 'room', localId: 1, data: { name: 'Playroom' } }),
      row({ entity: 'storage_spot', localId: 1, data: { name: 'Shelf', roomLocalId: 1 } }),
      row({ entity: 'toy', localId: 1, data: { name: 'Blocks', roomLocalId: 1, storageSpotLocalId: 1 } }),
      row({
        entity: 'play_session',
        localId: 1,
        data: { childLocalId: 1, toyLocalId: 1, status: 'interrupted', startedAt: '2026-01-01T00:00:00.000Z', interruptedAt: '2026-01-02T00:00:00.000Z' },
      }),
    ];

    await applyRestoredRows(database, HOUSEHOLD, rows);

    const session = await database.getFirstAsync<{ status: string; completed_at: string | null }>(
      'SELECT status, completed_at FROM play_sessions WHERE id = 1;',
    );
    expect(session).toMatchObject({ status: 'completed' });
    expect(session?.completed_at).not.toBeNull();
  });

  it('replaying a restore against a database that already has the rows does not duplicate — every id is a primary key', async () => {
    const database = await freshDatabase();
    const rows: RemoteRow[] = [row({ entity: 'room', localId: 1, data: { name: 'Playroom' } })];
    await applyRestoredRows(database, HOUSEHOLD, rows);

    const summary = await applyRestoredRows(database, HOUSEHOLD, rows);

    // The second attempt collides on the primary key and is reported, not
    // silently duplicated.
    expect(summary.rooms).toBe(0);
    expect(summary.skipped).toHaveLength(1);
    expect(await listRooms(database)).toHaveLength(1);
  });
});

describe('sync high-water mark', () => {
  it('starts at zero and advances monotonically', async () => {
    const database = await freshDatabase();
    expect(await getSyncedRevision(database, HOUSEHOLD)).toBe(0);

    await markSyncedRevision(database, HOUSEHOLD, 5);
    expect(await getSyncedRevision(database, HOUSEHOLD)).toBe(5);

    // A stale write (an interrupted sync retried out of order) never moves it backwards.
    await markSyncedRevision(database, HOUSEHOLD, 2);
    expect(await getSyncedRevision(database, HOUSEHOLD)).toBe(5);
  });
});

describe('recovery notifications', () => {
  it('lists an unacknowledged event and stops listing it once acknowledged', async () => {
    const database = await freshDatabase();
    await recordRecoveryEvent(database, HOUSEHOLD, 'toy', 5, 'photo-replaced', 'A toy photo was changed on another device too.');

    const events = await listUnacknowledgedRecoveryEvents(database, HOUSEHOLD);
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({ entity: 'toy', reason: 'photo-replaced' });

    await acknowledgeRecoveryEvent(database, events[0]!.id);

    expect(await listUnacknowledgedRecoveryEvents(database, HOUSEHOLD)).toHaveLength(0);
  });
});

describe('ensureRemoteHousehold', () => {
  it('creates the remote household once and reuses it on a retry', async () => {
    const database = await freshDatabase();
    const gateway = new FakeHouseholdGateway();

    const first = await ensureRemoteHousehold(database, gateway, HOUSEHOLD);
    const second = await ensureRemoteHousehold(database, gateway, HOUSEHOLD);

    expect(first).toBe(second);
  });
});

describe('restore, end to end, with a real photograph — not metadata only', () => {
  it('a restored toy ends up with a local managed image, not a remote path', async () => {
    const database = await freshDatabase();
    const gateway = new FakeHouseholdGateway();
    const storage = new FakeToyImageStorage();
    storage.setFingerprint('file:///tmp/downloaded/5/photo.jpg', 'server-fingerprint');

    // The image is imported first, exactly as the real orchestration would:
    // a toy row is only ever written with a local uri it can actually show.
    const { localUri } = await downloadAndImportToyImage(gateway, storage, 'remote-1', '5/photo.jpg');

    const rows = [
      { entity: 'room' as const, localId: 1, revision: 1, deletedAt: null, intent: { kind: 'edit' as const }, data: { name: 'Playroom' } },
      { entity: 'storage_spot' as const, localId: 1, revision: 1, deletedAt: null, intent: { kind: 'edit' as const }, data: { name: 'Shelf', roomLocalId: 1 } },
      { entity: 'toy' as const, localId: 5, revision: 1, deletedAt: null, intent: { kind: 'edit' as const }, data: { name: 'Wooden train', roomLocalId: 1, storageSpotLocalId: 1, imageUri: localUri } },
    ];

    const summary = await applyRestoredRows(database, HOUSEHOLD, rows);

    expect(summary.toys).toBe(1);
    const toy = await database.getFirstAsync<{ image_uri: string | null }>('SELECT image_uri FROM toys WHERE id = 5;');
    expect(toy?.image_uri).toBe(localUri);
    expect(toy?.image_uri).not.toMatch(/^https?:\/\//);
    expect(storage.copied).toContain(localUri);
  });
});
