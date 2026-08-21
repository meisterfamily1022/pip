import { LATEST_DATABASE_VERSION, LOCAL_HOUSEHOLD_ID, runMigrations } from "./migrations";
import { RealSqliteConnection } from "./real-sqlite-connection.test-helper";

/**
 * Migration behaviour against a real SQLite engine.
 *
 * These complement `migrations.test.ts`, which checks that the right SQL is
 * issued. Here the SQL actually runs, so constraints, backfills and index
 * behaviour are verified rather than assumed.
 */

type Database = RealSqliteConnection;

async function freshDatabase(): Promise<Database> {
  const database = new RealSqliteConnection();
  await runMigrations(database);
  return database;
}

/** A library that predates households, as an upgrading device would have. */
async function seedLegacyLibrary(database: Database): Promise<{ toyId: number; childId: number }> {
  await database.runAsync(
    "INSERT INTO households (id, name, is_local_only, created_at, updated_at) VALUES ('other', 'Other', 1, '2026-01-01', '2026-01-01');",
  );
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
  const spot = await database.getFirstAsync<{ id: number }>("SELECT id FROM storage_spots LIMIT 1;");
  await database.runAsync(
    `INSERT INTO toys (name, image_uri, room_id, storage_spot_id, household_id, created_at, updated_at)
     VALUES ('Magnetic Tiles', 'file:///t.jpg', ?, ?, ?, '2026-01-01', '2026-01-01');`,
    room!.id,
    spot!.id,
    LOCAL_HOUSEHOLD_ID,
  );
  const toy = await database.getFirstAsync<{ id: number }>("SELECT id FROM toys LIMIT 1;");
  await database.runAsync(
    "INSERT INTO child_profiles (name, household_id, created_at, updated_at) VALUES ('Maya', ?, '2026-01-01', '2026-01-01');",
    LOCAL_HOUSEHOLD_ID,
  );
  const child = await database.getFirstAsync<{ id: number }>("SELECT id FROM child_profiles LIMIT 1;");
  return { toyId: toy!.id, childId: child!.id };
}

async function startSession(database: Database, toyId: number, childId: number | null): Promise<void> {
  await database.runAsync(
    `INSERT INTO play_sessions (child_id, toy_id, status, started_at, household_id, created_at, updated_at)
     VALUES (?, ?, 'active', '2026-01-01', ?, '2026-01-01', '2026-01-01');`,
    childId,
    toyId,
    LOCAL_HOUSEHOLD_ID,
  );
}

describe("migration to the household schema", () => {
  let database: Database;

  beforeEach(async () => {
    database = await freshDatabase();
  });

  afterEach(() => {
    database.close();
  });

  it("reaches the latest version and creates exactly one local household", async () => {
    const version = await database.getFirstAsync<{ user_version: number }>("PRAGMA user_version;");
    expect(version?.user_version).toBe(LATEST_DATABASE_VERSION);

    const households = await database.getAllAsync<{ id: string }>("SELECT id FROM households;");
    expect(households).toEqual([{ id: LOCAL_HOUSEHOLD_ID }]);
  });

  it('persists Child Mode progress and backfills it from existing play records', async () => {
    const upgrading = new RealSqliteConnection();
    await runMigrations(upgrading, 11);
    await upgrading.runAsync("INSERT INTO settings (id, created_at, updated_at) VALUES (1, '2026-01-01', '2026-01-01');");
    const { toyId, childId } = await seedLegacyLibrary(upgrading);
    await startSession(upgrading, toyId, childId);
    await runMigrations(upgrading);
    const row = await upgrading.getFirstAsync<{ child_mode_used: number }>('SELECT child_mode_used FROM settings WHERE id = 1;');
    expect(row?.child_mode_used).toBe(1);
    upgrading.close();
  });

  it("is safe to rerun and does not create a second household", async () => {
    await runMigrations(database);
    await runMigrations(database);
    const rows = await database.getAllAsync<{ count: number }>("SELECT COUNT(*) AS count FROM households;");
    expect(rows[0].count).toBe(1);
  });

  it("keeps existing records and assigns them to the local household", async () => {
    const { toyId } = await seedLegacyLibrary(database);
    await runMigrations(database);

    const toy = await database.getFirstAsync<{ name: string; household_id: string; image_uri: string }>(
      "SELECT name, household_id, image_uri FROM toys WHERE id = ?;",
      toyId,
    );
    expect(toy).toEqual({ name: "Magnetic Tiles", household_id: LOCAL_HOUSEHOLD_ID, image_uri: "file:///t.jpg" });
  });

  it("gives every scoped table a household column and index", async () => {
    for (const table of ["rooms", "storage_spots", "toys", "child_profiles", "play_sessions"]) {
      const columns = await database.getAllAsync<{ name: string }>(`PRAGMA table_info("${table}");`);
      expect(columns.map((column) => column.name)).toContain("household_id");

      const indexes = await database.getAllAsync<{ name: string }>(`PRAGMA index_list("${table}");`);
      expect(indexes.map((index) => index.name)).toContain(`${table}_household_index`);
    }
  });

  it("refuses a record pointing at a household that does not exist", async () => {
    await expect(
      database.runAsync(
        "INSERT INTO rooms (name, household_id, created_at, updated_at) VALUES ('Ghost', 'nope', '2026-01-01', '2026-01-01');",
      ),
    ).rejects.toThrow();
  });
});

describe("child profile preferences", () => {
  let database: Database;

  beforeEach(async () => {
    database = await freshDatabase();
  });

  afterEach(() => {
    database.close();
  });

  it("carries the device-wide choice limit onto each existing child", async () => {
    // Build the database as version 8 left it, so the v9 backfill really runs.
    const upgrading = new RealSqliteConnection();
    await runMigrations(upgrading, 8);
    // Migrations create the settings table; the client seeds its single row.
    await upgrading.runAsync(
      "INSERT INTO settings (id, choice_limit, created_at, updated_at) VALUES (1, 5, '2026-01-01', '2026-01-01');",
    );
    await upgrading.runAsync(
      "INSERT INTO child_profiles (name, created_at, updated_at) VALUES ('Maya', '2026-01-01', '2026-01-01');",
    );

    await runMigrations(upgrading);

    const profile = await upgrading.getFirstAsync<{ choice_limit: number; household_id: string }>(
      "SELECT choice_limit, household_id FROM child_profiles WHERE name = 'Maya';",
    );
    expect(profile).toEqual({ choice_limit: 5, household_id: LOCAL_HOUSEHOLD_ID });
    upgrading.close();
  });

  it("falls back to three choices when the settings row has not been seeded", async () => {
    // Migrations create the settings table but the client seeds its row, so an
    // upgrade can legitimately run before any row exists.
    const upgrading = new RealSqliteConnection();
    await runMigrations(upgrading, 8);
    await upgrading.runAsync(
      "INSERT INTO child_profiles (name, created_at, updated_at) VALUES ('Maya', '2026-01-01', '2026-01-01');",
    );

    await runMigrations(upgrading);

    const profile = await upgrading.getFirstAsync<{ choice_limit: number }>(
      "SELECT choice_limit FROM child_profiles WHERE name = 'Maya';",
    );
    expect(profile?.choice_limit).toBe(3);
    upgrading.close();
  });

  it("defaults presentation so an upgraded profile is immediately usable", async () => {
    await database.runAsync(
      "INSERT INTO child_profiles (name, household_id, created_at, updated_at) VALUES ('Sam', ?, '2026-01-01', '2026-01-01');",
      LOCAL_HOUSEHOLD_ID,
    );
    const profile = await database.getFirstAsync<{
      avatar_id: string;
      accent_color_id: string;
      reading_support: string;
      hidden_at: string | null;
    }>("SELECT avatar_id, accent_color_id, reading_support, hidden_at FROM child_profiles WHERE name = 'Sam';");

    expect(profile).toEqual({
      avatar_id: "circle-dot",
      accent_color_id: "mint",
      reading_support: "pictures-words",
      hidden_at: null,
    });
  });

  it("rejects an unsupported choice limit or reading mode", async () => {
    await expect(
      database.runAsync(
        "INSERT INTO child_profiles (name, household_id, choice_limit, created_at, updated_at) VALUES ('Bad', ?, 4, '2026-01-01', '2026-01-01');",
        LOCAL_HOUSEHOLD_ID,
      ),
    ).rejects.toThrow();

    await expect(
      database.runAsync(
        "INSERT INTO child_profiles (name, household_id, reading_support, created_at, updated_at) VALUES ('Bad', ?, 'audio-only', '2026-01-01', '2026-01-01');",
        LOCAL_HOUSEHOLD_ID,
      ),
    ).rejects.toThrow();
  });
});

describe("toy availability and per-child visibility", () => {
  let database: Database;

  beforeEach(async () => {
    database = await freshDatabase();
  });

  afterEach(() => {
    database.close();
  });

  it("preserves what a hidden toy already meant", async () => {
    // A version 8 library where the parent had hidden one toy from the child.
    const upgrading = new RealSqliteConnection();
    await runMigrations(upgrading, 8);
    await upgrading.runAsync("INSERT INTO rooms (name, created_at, updated_at) VALUES ('Playroom', '2026-01-01', '2026-01-01');");
    await upgrading.runAsync(
      "INSERT INTO storage_spots (room_id, name, created_at, updated_at) VALUES (1, 'Blue Bin', '2026-01-01', '2026-01-01');",
    );
    await upgrading.runAsync(
      `INSERT INTO toys (name, room_id, storage_spot_id, is_available, created_at, updated_at)
       VALUES ('Hidden Puzzle', 1, 1, 0, '2026-01-01', '2026-01-01'),
              ('Open Blocks', 1, 1, 1, '2026-01-01', '2026-01-01');`,
    );

    await runMigrations(upgrading);

    const rows = await upgrading.getAllAsync<{ name: string; availability_scope: string }>(
      "SELECT name, availability_scope FROM toys ORDER BY name;",
    );
    expect(rows).toEqual([
      { name: "Hidden Puzzle", availability_scope: "parent_only" },
      { name: "Open Blocks", availability_scope: "everyone" },
    ]);
    upgrading.close();
  });

  it("leaves a visible toy available to everyone", async () => {
    const { toyId } = await seedLegacyLibrary(database);
    await runMigrations(database);
    const toy = await database.getFirstAsync<{ availability_scope: string }>(
      "SELECT availability_scope FROM toys WHERE id = ?;",
      toyId,
    );
    expect(toy?.availability_scope).toBe("everyone");
  });

  it("rejects an unknown availability scope", async () => {
    const { toyId } = await seedLegacyLibrary(database);
    await expect(database.runAsync("UPDATE toys SET availability_scope = 'sometimes' WHERE id = ?;", toyId)).rejects.toThrow();
  });

  it("records visibility once per child and clears it with the toy", async () => {
    const { toyId, childId } = await seedLegacyLibrary(database);
    await database.runAsync(
      "INSERT INTO toy_child_visibility (toy_id, child_id, created_at) VALUES (?, ?, '2026-01-01');",
      toyId,
      childId,
    );
    await expect(
      database.runAsync(
        "INSERT INTO toy_child_visibility (toy_id, child_id, created_at) VALUES (?, ?, '2026-01-02');",
        toyId,
        childId,
      ),
    ).rejects.toThrow();

    await database.runAsync("DELETE FROM play_sessions WHERE toy_id = ?;", toyId);
    await database.runAsync("DELETE FROM toys WHERE id = ?;", toyId);
    const remaining = await database.getAllAsync("SELECT toy_id FROM toy_child_visibility;");
    expect(remaining).toEqual([]);
  });
});

describe("independent play sessions", () => {
  let database: Database;

  beforeEach(async () => {
    database = await freshDatabase();
  });

  afterEach(() => {
    database.close();
  });

  async function addChild(name: string): Promise<number> {
    await database.runAsync(
      "INSERT INTO child_profiles (name, household_id, created_at, updated_at) VALUES (?, ?, '2026-01-01', '2026-01-01');",
      name,
      LOCAL_HOUSEHOLD_ID,
    );
    const row = await database.getFirstAsync<{ id: number }>("SELECT id FROM child_profiles WHERE name = ?;", name);
    return row!.id;
  }

  async function addToy(name: string): Promise<number> {
    const room = await database.getFirstAsync<{ id: number }>("SELECT id FROM rooms LIMIT 1;");
    const spot = await database.getFirstAsync<{ id: number }>("SELECT id FROM storage_spots LIMIT 1;");
    await database.runAsync(
      `INSERT INTO toys (name, room_id, storage_spot_id, household_id, created_at, updated_at)
       VALUES (?, ?, ?, ?, '2026-01-01', '2026-01-01');`,
      name,
      room!.id,
      spot!.id,
      LOCAL_HOUSEHOLD_ID,
    );
    const row = await database.getFirstAsync<{ id: number }>("SELECT id FROM toys WHERE name = ?;", name);
    return row!.id;
  }

  it("lets two children play at the same time without overwriting each other", async () => {
    await seedLegacyLibrary(database);
    const maya = await database.getFirstAsync<{ id: number }>("SELECT id FROM child_profiles WHERE name = 'Maya';");
    const sam = await addChild("Sam");
    const tiles = await addToy("Tiles");
    const blocks = await addToy("Blocks");

    await startSession(database, tiles, maya!.id);
    await startSession(database, blocks, sam);

    const active = await database.getAllAsync<{ child_id: number }>(
      "SELECT child_id FROM play_sessions WHERE status = 'active' ORDER BY child_id;",
    );
    expect(active).toHaveLength(2);
  });

  it("allows only one active session per child", async () => {
    await seedLegacyLibrary(database);
    const maya = await database.getFirstAsync<{ id: number }>("SELECT id FROM child_profiles WHERE name = 'Maya';");
    const tiles = await addToy("Tiles");
    const blocks = await addToy("Blocks");

    await startSession(database, tiles, maya!.id);
    await expect(startSession(database, blocks, maya!.id)).rejects.toThrow();
  });

  it("allows only one active Guest session, despite Guest storing a null child", async () => {
    await seedLegacyLibrary(database);
    const tiles = await addToy("Tiles");
    const blocks = await addToy("Blocks");

    await startSession(database, tiles, null);
    await expect(startSession(database, blocks, null)).rejects.toThrow();
  });

  it("lets Guest play alongside a named child", async () => {
    await seedLegacyLibrary(database);
    const maya = await database.getFirstAsync<{ id: number }>("SELECT id FROM child_profiles WHERE name = 'Maya';");
    const tiles = await addToy("Tiles");
    const blocks = await addToy("Blocks");

    await startSession(database, tiles, maya!.id);
    await startSession(database, blocks, null);

    const rows = await database.getAllAsync<{ count: number }>(
      "SELECT COUNT(*) AS count FROM play_sessions WHERE status = 'active';",
    );
    expect(rows[0].count).toBe(2);
  });

  it("keeps one physical toy out of two simultaneous sessions", async () => {
    await seedLegacyLibrary(database);
    const maya = await database.getFirstAsync<{ id: number }>("SELECT id FROM child_profiles WHERE name = 'Maya';");
    const sam = await addChild("Sam");
    const tiles = await addToy("Tiles");

    await startSession(database, tiles, maya!.id);
    await expect(startSession(database, tiles, sam)).rejects.toThrow();
  });
});

describe("deletion tombstones", () => {
  it("records a deletion once per entity so a retry cannot duplicate it", async () => {
    const database = await freshDatabase();
    await database.runAsync(
      "INSERT INTO deleted_records (entity, entity_id, household_id, deleted_at) VALUES ('toy', '12', ?, '2026-01-01');",
      LOCAL_HOUSEHOLD_ID,
    );
    await expect(
      database.runAsync(
        "INSERT INTO deleted_records (entity, entity_id, household_id, deleted_at) VALUES ('toy', '12', ?, '2026-01-02');",
        LOCAL_HOUSEHOLD_ID,
      ),
    ).rejects.toThrow();
    database.close();
  });
});
