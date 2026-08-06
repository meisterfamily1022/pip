import { LOCAL_HOUSEHOLD_ID, runMigrations } from '@/database/migrations';
import { RealSqliteConnection } from '@/database/real-sqlite-connection.test-helper';
import { ensureSettings } from '@/repositories/settings-repository';
import {
  SAMPLE_PREFIX,
  countSampleToys,
  hasSampleLibrary,
  removeSampleLibrary,
  seedSampleLibrary,
} from './sample-library';

async function setUp(): Promise<RealSqliteConnection> {
  const database = new RealSqliteConnection();
  await runMigrations(database);
  await ensureSettings(database);
  return database;
}

/** A room and toy the parent created themselves, which must survive a reset. */
async function seedRealLibrary(database: RealSqliteConnection): Promise<void> {
  await database.runAsync(
    "INSERT INTO rooms (name, household_id, created_at, updated_at) VALUES ('Playroom', ?, '2026-01-01', '2026-01-01');",
    LOCAL_HOUSEHOLD_ID,
  );
  const room = await database.getFirstAsync<{ id: number }>("SELECT id FROM rooms WHERE name = 'Playroom';");
  await database.runAsync(
    "INSERT INTO storage_spots (room_id, name, household_id, created_at, updated_at) VALUES (?, 'Blue Bin', ?, '2026-01-01', '2026-01-01');",
    room!.id,
    LOCAL_HOUSEHOLD_ID,
  );
  const spot = await database.getFirstAsync<{ id: number }>("SELECT id FROM storage_spots WHERE name = 'Blue Bin';");
  await database.runAsync(
    `INSERT INTO toys (name, room_id, storage_spot_id, household_id, created_at, updated_at)
     VALUES ('Real Train', ?, ?, ?, '2026-01-01', '2026-01-01');`,
    room!.id,
    spot!.id,
    LOCAL_HOUSEHOLD_ID,
  );
}

describe('sample library', () => {
  let database: RealSqliteConnection;

  beforeEach(async () => {
    database = await setUp();
  });

  afterEach(() => {
    database.close();
  });

  it('seeds a small library a parent can immediately try', async () => {
    const added = await seedSampleLibrary(database);

    expect(added).toBeGreaterThan(0);
    expect(await hasSampleLibrary(database)).toBe(true);
    expect(await countSampleToys(database)).toBe(added);

    const rooms = await database.getAllAsync<{ name: string }>('SELECT name FROM rooms WHERE is_sample = 1;');
    expect(rooms.length).toBeGreaterThan(0);
  });

  it('names every sample row so it cannot be mistaken for a real toy', async () => {
    await seedSampleLibrary(database);

    for (const table of ['rooms', 'storage_spots', 'toys']) {
      const rows = await database.getAllAsync<{ name: string }>(`SELECT name FROM "${table}" WHERE is_sample = 1;`);
      expect(rows.length).toBeGreaterThan(0);
      for (const row of rows) expect(row.name.startsWith(SAMPLE_PREFIX)).toBe(true);
    }
  });

  it('gives every sample toy a real location and at least one category', async () => {
    await seedSampleLibrary(database);

    const orphans = await database.getAllAsync(
      `SELECT t.id FROM toys t
        LEFT JOIN rooms r ON r.id = t.room_id
        LEFT JOIN storage_spots s ON s.id = t.storage_spot_id
       WHERE t.is_sample = 1 AND (r.id IS NULL OR s.id IS NULL);`,
    );
    expect(orphans).toEqual([]);

    const uncategorised = await database.getAllAsync(
      `SELECT id FROM toys WHERE is_sample = 1
         AND NOT EXISTS (SELECT 1 FROM toy_categories c WHERE c.toy_id = toys.id);`,
    );
    expect(uncategorised).toEqual([]);
  });

  it('adds nothing on a second call, so a double tap cannot duplicate it', async () => {
    const first = await seedSampleLibrary(database);
    const second = await seedSampleLibrary(database);

    expect(second).toBe(0);
    expect(await countSampleToys(database)).toBe(first);
  });

  it('removes every sample row and reports how many toys went', async () => {
    const added = await seedSampleLibrary(database);
    const removed = await removeSampleLibrary(database);

    expect(removed).toBe(added);
    expect(await hasSampleLibrary(database)).toBe(false);
    expect(await database.getAllAsync('SELECT id FROM rooms WHERE is_sample = 1;')).toEqual([]);
    expect(await database.getAllAsync('SELECT id FROM storage_spots WHERE is_sample = 1;')).toEqual([]);
  });

  it("never touches the family's own toys, rooms, or storage spots", async () => {
    await seedRealLibrary(database);
    await seedSampleLibrary(database);

    await removeSampleLibrary(database);

    const toys = await database.getAllAsync<{ name: string }>('SELECT name FROM toys;');
    expect(toys).toEqual([{ name: 'Real Train' }]);
    const rooms = await database.getAllAsync<{ name: string }>('SELECT name FROM rooms;');
    expect(rooms).toEqual([{ name: 'Playroom' }]);
    const spots = await database.getAllAsync<{ name: string }>('SELECT name FROM storage_spots;');
    expect(spots).toEqual([{ name: 'Blue Bin' }]);
  });

  it('removes play sessions that referenced a sample toy', async () => {
    await seedSampleLibrary(database);
    await database.runAsync(
      "INSERT INTO child_profiles (name, household_id, created_at, updated_at) VALUES ('Maya', ?, '2026-01-01', '2026-01-01');",
      LOCAL_HOUSEHOLD_ID,
    );
    const child = await database.getFirstAsync<{ id: number }>('SELECT id FROM child_profiles LIMIT 1;');
    const toy = await database.getFirstAsync<{ id: number }>('SELECT id FROM toys WHERE is_sample = 1 LIMIT 1;');
    await database.runAsync(
      `INSERT INTO play_sessions (child_id, toy_id, status, started_at, household_id, created_at, updated_at)
       VALUES (?, ?, 'active', '2026-01-01', ?, '2026-01-01', '2026-01-01');`,
      child!.id,
      toy!.id,
      LOCAL_HOUSEHOLD_ID,
    );

    // Would fail on the RESTRICT foreign key if sessions were not cleared first.
    await expect(removeSampleLibrary(database)).resolves.toBeGreaterThan(0);
    expect(await database.getAllAsync('SELECT id FROM play_sessions;')).toEqual([]);
  });

  it('can be seeded again after being removed', async () => {
    const first = await seedSampleLibrary(database);
    await removeSampleLibrary(database);
    expect(await seedSampleLibrary(database)).toBe(first);
  });

  it('treats removal with nothing to remove as harmless', async () => {
    await expect(removeSampleLibrary(database)).resolves.toBe(0);
  });
});
