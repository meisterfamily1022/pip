import { LOCAL_HOUSEHOLD_ID, runMigrations } from './migrations';
import { RealSqliteConnection } from './real-sqlite-connection.test-helper';

/**
 * Migration 20 replaces migration 19's SQL approximation of the name rule with
 * a stored, canonically normalised column. Rows that slipped past the weaker
 * index must not be destroyed by the stronger one.
 */
async function seedAtVersion19(names: readonly string[]): Promise<RealSqliteConnection> {
  const database = new RealSqliteConnection();
  await runMigrations(database, 19);
  let order = 0;
  for (const name of names) {
    order += 1;
    await database.runAsync(
      `INSERT INTO child_profiles
         (name, household_id, avatar_id, accent_color_id, choice_limit, reading_support, display_order, created_at, updated_at)
       VALUES (?, ?, 'circle-dot', 'mint', 3, 'pictures-words', ?, '2026-01-01', '2026-01-01');`,
      name,
      LOCAL_HOUSEHOLD_ID,
      order,
    );
  }
  return database;
}

describe('upgrading child names to a stored normalised form', () => {
  it('backfills every existing row deterministically', async () => {
    const database = await seedAtVersion19(['  Maya ', 'Sam\tSmith', 'ROSA']);

    await runMigrations(database);

    const rows = await database.getAllAsync<{ name: string; normalized_name: string }>(
      'SELECT name, normalized_name FROM child_profiles ORDER BY id;',
    );
    expect(rows.map((row) => row.normalized_name)).toEqual(['maya', 'sam smith', 'rosa']);
    database.close();
  });

  it('refuses to upgrade, and keeps every profile, when legacy rows collide', async () => {
    // Both slipped past migration 19: its nested replace() could not see a tab
    // or a run of spaces this long as the same separator.
    const database = await seedAtVersion19(['Sam Smith', `Sam${' '.repeat(40)}Smith`]);

    await expect(runMigrations(database)).rejects.toThrow(/Cannot make child names unique per household/);

    const rows = await database.getAllAsync<{ name: string }>('SELECT name FROM child_profiles ORDER BY id;');
    expect(rows).toHaveLength(2);
    const version = await database.getFirstAsync<{ user_version: number }>('PRAGMA user_version;');
    expect(version?.user_version).toBe(19);
    database.close();
  });

  it('names both sides of the collision so a parent can be told which to rename', async () => {
    const database = await seedAtVersion19(['Sam Smith', 'SAM\tSMITH']);

    await expect(runMigrations(database)).rejects.toThrow(/"Sam Smith" and "SAM\tSMITH"/);
    database.close();
  });

  it('drops the superseded index', async () => {
    const database = await seedAtVersion19(['Maya']);

    await runMigrations(database);

    const indexes = await database.getAllAsync<{ name: string }>(
      "SELECT name FROM sqlite_master WHERE type = 'index' AND tbl_name = 'child_profiles';",
    );
    const names = indexes.map((index) => index.name);
    expect(names).toContain('child_profile_normalized_name_per_household');
    expect(names).not.toContain('child_profile_name_per_household');
    database.close();
  });
});
