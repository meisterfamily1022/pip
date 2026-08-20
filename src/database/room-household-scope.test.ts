import { LATEST_DATABASE_VERSION, LOCAL_HOUSEHOLD_ID, runMigrations } from './migrations';
import { RealSqliteConnection } from './real-sqlite-connection.test-helper';
import type { DatabaseConnection } from './types';

/**
 * Migration 17 (rooms rebuild) and 18 (Guest session index), against real
 * SQLite.
 *
 * These prove the two defects flagged during Prompt 4 restore design are
 * actually fixed, not just that the migration SQL parses: a device-wide
 * UNIQUE on rooms.name, and a device-wide "one active Guest session" index —
 * both artifacts of a schema that assumed one household per device, which
 * Prompt 1 already established is no longer true.
 */

async function seedOtherHousehold(database: DatabaseConnection, id: string): Promise<void> {
  await database.runAsync(
    `INSERT INTO households (id, name, is_local_only, created_at, updated_at) VALUES (?, 'Other household', 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);`,
    id,
  );
}

describe('rooms rebuild (migration 17)', () => {
  it('lets two different households use the same room name', async () => {
    const database = new RealSqliteConnection();
    await runMigrations(database);
    await seedOtherHousehold(database, 'other');

    await database.runAsync(
      `INSERT INTO rooms (name, household_id, created_at, updated_at) VALUES ('Playroom', ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);`,
      LOCAL_HOUSEHOLD_ID,
    );

    // The exact case that broke restore: a second household naming a room
    // exactly what the first household already has.
    await expect(
      database.runAsync(
        `INSERT INTO rooms (name, household_id, created_at, updated_at) VALUES ('Playroom', ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);`,
        'other',
      ),
    ).resolves.toMatchObject({ changes: 1 });

    const rooms = await database.getAllAsync<{ name: string; household_id: string }>(
      "SELECT name, household_id FROM rooms WHERE name = 'Playroom' ORDER BY household_id;",
    );
    expect(rooms).toHaveLength(2);
  });

  it('still refuses two rooms with the same name inside one household, case-insensitively', async () => {
    const database = new RealSqliteConnection();
    await runMigrations(database);

    await database.runAsync(
      `INSERT INTO rooms (name, household_id, created_at, updated_at) VALUES ('Playroom', ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);`,
      LOCAL_HOUSEHOLD_ID,
    );

    await expect(
      database.runAsync(
        `INSERT INTO rooms (name, household_id, created_at, updated_at) VALUES ('PLAYROOM', ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);`,
        LOCAL_HOUSEHOLD_ID,
      ),
    ).rejects.toThrow(/UNIQUE/);
  });

  it('preserves existing rooms, storage spots, and toys, with every reference still resolving', async () => {
    const database = new RealSqliteConnection();
    await runMigrations(database, 16);

    const room = await database.runAsync(
      `INSERT INTO rooms (name, household_id, is_sample, created_at, updated_at) VALUES ('Playroom', ?, 0, '2026-01-01', '2026-01-02');`,
      LOCAL_HOUSEHOLD_ID,
    );
    const spot = await database.runAsync(
      `INSERT INTO storage_spots (room_id, name, household_id, created_at, updated_at) VALUES (?, 'Shelf', ?, '2026-01-01', '2026-01-01');`,
      room.lastInsertRowId,
      LOCAL_HOUSEHOLD_ID,
    );
    await database.runAsync(
      `INSERT INTO toys (name, room_id, storage_spot_id, household_id, created_at, updated_at) VALUES ('Blocks', ?, ?, ?, '2026-01-01', '2026-01-01');`,
      room.lastInsertRowId,
      spot.lastInsertRowId,
      LOCAL_HOUSEHOLD_ID,
    );

    await runMigrations(database);

    const restoredRoom = await database.getFirstAsync<{ name: string; household_id: string; is_sample: number; created_at: string; updated_at: string }>(
      'SELECT name, household_id, is_sample, created_at, updated_at FROM rooms WHERE id = ?;',
      room.lastInsertRowId,
    );
    expect(restoredRoom).toEqual({
      name: 'Playroom',
      household_id: LOCAL_HOUSEHOLD_ID,
      is_sample: 0,
      created_at: '2026-01-01',
      updated_at: '2026-01-02',
    });

    // The join is the real proof: storage_spots.room_id and toys.room_id
    // still resolve to the same row after the table was rebuilt under a new
    // identity and renamed back.
    const joined = await database.getFirstAsync<{ toy_name: string; spot_name: string; room_name: string }>(
      `SELECT t.name AS toy_name, s.name AS spot_name, r.name AS room_name
         FROM toys t JOIN storage_spots s ON s.id = t.storage_spot_id JOIN rooms r ON r.id = t.room_id
        WHERE t.name = 'Blocks';`,
    );
    expect(joined).toEqual({ toy_name: 'Blocks', spot_name: 'Shelf', room_name: 'Playroom' });
  });

  it('leaves the database with no foreign-key inconsistencies', async () => {
    const database = new RealSqliteConnection();
    await runMigrations(database, 16);
    await database.runAsync(
      `INSERT INTO rooms (name, household_id, created_at, updated_at) VALUES ('Playroom', ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);`,
      LOCAL_HOUSEHOLD_ID,
    );

    await runMigrations(database);

    const problems = await database.getAllAsync('PRAGMA foreign_key_check;');
    expect(problems).toHaveLength(0);
  });

  it('leaves foreign-key enforcement switched back on for everything that follows', async () => {
    const database = new RealSqliteConnection();
    await runMigrations(database);

    await expect(
      database.runAsync(
        `INSERT INTO storage_spots (room_id, name, household_id, created_at, updated_at) VALUES (999999, 'Orphan', ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);`,
        LOCAL_HOUSEHOLD_ID,
      ),
    ).rejects.toThrow(/FOREIGN KEY/);
  });

  it('is idempotent across a relaunch that reruns every migration', async () => {
    const database = new RealSqliteConnection();
    await runMigrations(database);
    await database.runAsync(
      `INSERT INTO rooms (name, household_id, created_at, updated_at) VALUES ('Playroom', ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);`,
      LOCAL_HOUSEHOLD_ID,
    );

    // Simulates the app reopening: migrations run again against the same file.
    await runMigrations(database);
    await runMigrations(database);

    const rooms = await database.getAllAsync('SELECT id FROM rooms;');
    expect(rooms).toHaveLength(1);
    const version = await database.getFirstAsync<{ user_version: number }>('PRAGMA user_version;');
    expect(version?.user_version).toBe(LATEST_DATABASE_VERSION);
  });

  it('rolls back cleanly and leaves the original table intact if the rebuild fails partway', async () => {
    const database = new RealSqliteConnection();
    await runMigrations(database, 16);
    await database.runAsync(
      `INSERT INTO rooms (name, household_id, created_at, updated_at) VALUES ('Playroom', ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);`,
      LOCAL_HOUSEHOLD_ID,
    );
    // A table already named `rooms_rebuild` — the migration's working name —
    // forces its own CREATE TABLE to fail partway through, standing in for
    // any failure mid-rebuild. The transaction's rollback is what is under
    // test, not what specifically triggered it.
    await database.execAsync('CREATE TABLE rooms_rebuild (poisoned INTEGER);');

    await expect(runMigrations(database)).rejects.toThrow();

    // The original rooms table — never renamed away until the copy succeeds —
    // is untouched: same row, same version, nothing half-migrated.
    const rooms = await database.getAllAsync<{ name: string }>('SELECT name FROM rooms;');
    expect(rooms).toEqual([{ name: 'Playroom' }]);
    const version = await database.getFirstAsync<{ user_version: number }>('PRAGMA user_version;');
    expect(version?.user_version).toBe(16);
  });
});

describe('Guest session index, scoped per household (migration 18)', () => {
  async function seedRoomAndSpot(database: DatabaseConnection, householdId: string): Promise<{ roomId: number; spotId: number }> {
    const room = await database.runAsync(
      `INSERT INTO rooms (name, household_id, created_at, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);`,
      `Playroom-${householdId}`,
      householdId,
    );
    const spot = await database.runAsync(
      `INSERT INTO storage_spots (room_id, name, household_id, created_at, updated_at) VALUES (?, 'Shelf', ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);`,
      room.lastInsertRowId,
      householdId,
    );
    return { roomId: room.lastInsertRowId, spotId: spot.lastInsertRowId };
  }

  async function seedToy(database: DatabaseConnection, householdId: string, roomId: number, spotId: number): Promise<number> {
    const toy = await database.runAsync(
      `INSERT INTO toys (name, room_id, storage_spot_id, household_id, created_at, updated_at) VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);`,
      `Toy-${householdId}`,
      roomId,
      spotId,
      householdId,
    );
    return toy.lastInsertRowId;
  }

  it('allows two households to each have an active Guest session at once', async () => {
    const database = new RealSqliteConnection();
    await runMigrations(database);
    await seedOtherHousehold(database, 'other');

    const local = await seedRoomAndSpot(database, LOCAL_HOUSEHOLD_ID);
    const localToy = await seedToy(database, LOCAL_HOUSEHOLD_ID, local.roomId, local.spotId);
    const other = await seedRoomAndSpot(database, 'other');
    const otherToy = await seedToy(database, 'other', other.roomId, other.spotId);

    await database.runAsync(
      `INSERT INTO play_sessions (toy_id, child_id, status, started_at, household_id, created_at, updated_at)
       VALUES (?, NULL, 'active', CURRENT_TIMESTAMP, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);`,
      localToy,
      LOCAL_HOUSEHOLD_ID,
    );

    // The device-local household's Guest session is active. A second,
    // unrelated household's own Guest session must not be blocked by it.
    await expect(
      database.runAsync(
        `INSERT INTO play_sessions (toy_id, child_id, status, started_at, household_id, created_at, updated_at)
         VALUES (?, NULL, 'active', CURRENT_TIMESTAMP, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);`,
        otherToy,
        'other',
      ),
    ).resolves.toMatchObject({ changes: 1 });

    const active = await database.getAllAsync<{ household_id: string }>(
      "SELECT household_id FROM play_sessions WHERE status = 'active' AND child_id IS NULL ORDER BY household_id;",
    );
    expect(active).toHaveLength(2);
  });

  it('still refuses two simultaneous Guest sessions within the same household', async () => {
    const database = new RealSqliteConnection();
    await runMigrations(database);
    const { roomId, spotId } = await seedRoomAndSpot(database, LOCAL_HOUSEHOLD_ID);
    const toyA = await seedToy(database, LOCAL_HOUSEHOLD_ID, roomId, spotId);
    const toyB = await seedToy(database, LOCAL_HOUSEHOLD_ID, roomId, spotId);

    await database.runAsync(
      `INSERT INTO play_sessions (toy_id, child_id, status, started_at, household_id, created_at, updated_at)
       VALUES (?, NULL, 'active', CURRENT_TIMESTAMP, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);`,
      toyA,
      LOCAL_HOUSEHOLD_ID,
    );

    await expect(
      database.runAsync(
        `INSERT INTO play_sessions (toy_id, child_id, status, started_at, household_id, created_at, updated_at)
         VALUES (?, NULL, 'active', CURRENT_TIMESTAMP, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);`,
        toyB,
        LOCAL_HOUSEHOLD_ID,
      ),
    ).rejects.toThrow(/UNIQUE/);
  });
});
