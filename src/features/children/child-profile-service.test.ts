import { LOCAL_HOUSEHOLD_ID, runMigrations } from '@/database/migrations';
import { RealSqliteConnection } from '@/database/real-sqlite-connection.test-helper';
import { ensureSettings } from '@/repositories/settings-repository';
import {
  ChildProfileError,
  addChildProfile,
  clearChildHistory,
  deleteChildProfile,
  loadChildProfiles,
  reorderChildren,
  saveChildProfile,
  setChildHidden,
} from './child-profile-service';

/**
 * Exercised against a real SQLite engine, because the deletion path depends on
 * foreign-key behaviour that a fake would not enforce.
 */

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

async function addToy(fixture: Fixture, name: string): Promise<number> {
  await fixture.database.runAsync(
    `INSERT INTO toys (name, room_id, storage_spot_id, household_id, created_at, updated_at)
     VALUES (?, ?, ?, ?, '2026-01-01', '2026-01-01');`,
    name,
    fixture.roomId,
    fixture.spotId,
    LOCAL_HOUSEHOLD_ID,
  );
  const row = await fixture.database.getFirstAsync<{ id: number }>('SELECT id FROM toys WHERE name = ?;', name);
  return row!.id;
}

async function startSession(fixture: Fixture, toyId: number, childId: number, status: 'active' | 'completed'): Promise<void> {
  await fixture.database.runAsync(
    `INSERT INTO play_sessions (child_id, toy_id, status, started_at, completed_at, household_id, created_at, updated_at)
     VALUES (?, ?, ?, '2026-01-01', ?, ?, '2026-01-01', '2026-01-01');`,
    childId,
    toyId,
    status,
    status === 'completed' ? '2026-01-02' : null,
    LOCAL_HOUSEHOLD_ID,
  );
}

describe('creating and editing profiles', () => {
  let fixture: Fixture;

  beforeEach(async () => {
    fixture = await setUp();
  });

  afterEach(() => {
    fixture.database.close();
  });

  it('stores the full set of per-child preferences', async () => {
    const profile = await addChildProfile(fixture.database, {
      name: 'Maya',
      avatarId: 'petal-ring',
      accentColorId: 'lavender',
      ageRange: '4-5',
      choiceLimit: 5,
      readingSupport: 'pictures',
    });

    expect(profile).toMatchObject({
      name: 'Maya',
      avatarId: 'petal-ring',
      accentColorId: 'lavender',
      ageRange: '4-5',
      choiceLimit: 5,
      readingSupport: 'pictures',
      hiddenAt: null,
    });
  });

  it('keeps several profiles independent', async () => {
    await addChildProfile(fixture.database, { name: 'Maya', choiceLimit: 1 });
    await addChildProfile(fixture.database, { name: 'Sam', choiceLimit: 5 });

    const profiles = await loadChildProfiles(fixture.database);
    expect(profiles.map((p) => [p.name, p.choiceLimit])).toEqual([
      ['Maya', 1],
      ['Sam', 5],
    ]);
  });

  it('rejects a name that is too short', async () => {
    await expect(addChildProfile(fixture.database, { name: 'A' })).rejects.toBeInstanceOf(ChildProfileError);
  });

  it('refuses a duplicate name whatever its casing or surrounding space', async () => {
    await addChildProfile(fixture.database, { name: 'Maya' });
    for (const name of ['Maya', 'maya', '  MAYA  ']) {
      await expect(addChildProfile(fixture.database, { name })).rejects.toBeInstanceOf(ChildProfileError);
    }
    expect(await loadChildProfiles(fixture.database)).toHaveLength(1);
  });

  it('treats a double space inside a name as the same name', async () => {
    await addChildProfile(fixture.database, { name: 'Mary Ann' });
    await expect(addChildProfile(fixture.database, { name: 'Mary  Ann' })).rejects.toBeInstanceOf(ChildProfileError);
  });

  it('still allows a genuinely different name that only looks similar', async () => {
    await addChildProfile(fixture.database, { name: 'Maya' });
    // "Ma ya" is a different name, not a duplicate.
    await expect(addChildProfile(fixture.database, { name: 'Ma ya' })).resolves.toMatchObject({ name: 'Ma ya' });
  });

  it('lets a profile keep its own name while editing', async () => {
    const profile = await addChildProfile(fixture.database, { name: 'Maya' });
    const saved = await saveChildProfile(fixture.database, profile.id, { name: 'Maya', choiceLimit: 3 });
    expect(saved.name).toBe('Maya');
  });

  it('still refuses to rename onto another profile', async () => {
    await addChildProfile(fixture.database, { name: 'Maya' });
    const sam = await addChildProfile(fixture.database, { name: 'Sam' });
    await expect(saveChildProfile(fixture.database, sam.id, { name: 'maya' })).rejects.toBeInstanceOf(ChildProfileError);
  });
});

describe('hiding and ordering', () => {
  let fixture: Fixture;

  beforeEach(async () => {
    fixture = await setUp();
  });

  afterEach(() => {
    fixture.database.close();
  });

  it('hides a profile from the default list but keeps it', async () => {
    const profile = await addChildProfile(fixture.database, { name: 'Maya' });
    await setChildHidden(fixture.database, profile.id, true);

    expect(await loadChildProfiles(fixture.database)).toHaveLength(0);
    expect(await loadChildProfiles(fixture.database, { includeHidden: true })).toHaveLength(1);

    await setChildHidden(fixture.database, profile.id, false);
    expect(await loadChildProfiles(fixture.database)).toHaveLength(1);
  });

  it('applies a new order', async () => {
    const maya = await addChildProfile(fixture.database, { name: 'Maya' });
    const sam = await addChildProfile(fixture.database, { name: 'Sam' });
    const ali = await addChildProfile(fixture.database, { name: 'Ali' });

    const reordered = await reorderChildren(fixture.database, [ali.id, maya.id, sam.id]);
    expect(reordered.map((p) => p.name)).toEqual(['Ali', 'Maya', 'Sam']);
  });

  it('keeps omitted profiles rather than dropping them from the order', async () => {
    const maya = await addChildProfile(fixture.database, { name: 'Maya' });
    await addChildProfile(fixture.database, { name: 'Sam' });

    const reordered = await reorderChildren(fixture.database, [maya.id]);
    expect(reordered).toHaveLength(2);
    expect(reordered[0].name).toBe('Maya');
  });

  it('ignores ids that do not belong to the household', async () => {
    const maya = await addChildProfile(fixture.database, { name: 'Maya' });
    const reordered = await reorderChildren(fixture.database, [9999, maya.id]);
    expect(reordered.map((p) => p.name)).toEqual(['Maya']);
  });

  it('leaves every profile with a distinct position after repeated reorders', async () => {
    const maya = await addChildProfile(fixture.database, { name: 'Maya' });
    const sam = await addChildProfile(fixture.database, { name: 'Sam' });

    await reorderChildren(fixture.database, [sam.id, maya.id]);
    await reorderChildren(fixture.database, [sam.id, maya.id]);

    const profiles = await loadChildProfiles(fixture.database, { includeHidden: true });
    expect(new Set(profiles.map((p) => p.displayOrder)).size).toBe(profiles.length);
  });
});

describe('deleting a profile', () => {
  let fixture: Fixture;

  beforeEach(async () => {
    fixture = await setUp();
  });

  afterEach(() => {
    fixture.database.close();
  });

  it('never removes household toys, rooms, or storage spots', async () => {
    const toyId = await addToy(fixture, 'Magnetic Tiles');
    const maya = await addChildProfile(fixture.database, { name: 'Maya' });
    await startSession(fixture, toyId, maya.id, 'completed');

    await deleteChildProfile(fixture.database, maya.id);

    expect(await fixture.database.getAllAsync('SELECT id FROM toys;')).toHaveLength(1);
    expect(await fixture.database.getAllAsync('SELECT id FROM rooms;')).toHaveLength(1);
    expect(await fixture.database.getAllAsync('SELECT id FROM storage_spots;')).toHaveLength(1);
  });

  it('removes that profile play history and reports how much', async () => {
    const toyId = await addToy(fixture, 'Magnetic Tiles');
    const maya = await addChildProfile(fixture.database, { name: 'Maya' });
    await startSession(fixture, toyId, maya.id, 'completed');
    await startSession(fixture, toyId, maya.id, 'active');

    const summary = await deleteChildProfile(fixture.database, maya.id);

    expect(summary.removedSessions).toBe(2);
    expect(await fixture.database.getAllAsync('SELECT id FROM play_sessions;')).toHaveLength(0);
  });

  it("leaves another child's history alone", async () => {
    const tiles = await addToy(fixture, 'Tiles');
    const blocks = await addToy(fixture, 'Blocks');
    const maya = await addChildProfile(fixture.database, { name: 'Maya' });
    const sam = await addChildProfile(fixture.database, { name: 'Sam' });
    await startSession(fixture, tiles, maya.id, 'completed');
    await startSession(fixture, blocks, sam.id, 'completed');

    await deleteChildProfile(fixture.database, maya.id);

    const remaining = await fixture.database.getAllAsync<{ child_id: number }>('SELECT child_id FROM play_sessions;');
    expect(remaining).toEqual([{ child_id: sam.id }]);
  });

  it('clears the active pointer when the active child is deleted', async () => {
    const maya = await addChildProfile(fixture.database, { name: 'Maya' });
    await fixture.database.runAsync('UPDATE settings SET active_child_id = ? WHERE id = 1;', maya.id);

    await deleteChildProfile(fixture.database, maya.id);

    const settings = await fixture.database.getFirstAsync<{ active_child_id: number | null }>(
      'SELECT active_child_id FROM settings WHERE id = 1;',
    );
    expect(settings?.active_child_id).toBeNull();
  });

  it('reports a profile that is already gone rather than failing silently', async () => {
    await expect(deleteChildProfile(fixture.database, 4242)).rejects.toBeInstanceOf(ChildProfileError);
  });

  it('clears completed history without removing the profile or an active session', async () => {
    const toyId = await addToy(fixture, 'Magnetic Tiles');
    const maya = await addChildProfile(fixture.database, { name: 'Maya' });
    await startSession(fixture, toyId, maya.id, 'completed');
    await startSession(fixture, toyId, maya.id, 'active');

    const cleared = await clearChildHistory(fixture.database, maya.id);

    expect(cleared).toBe(1);
    expect(await loadChildProfiles(fixture.database)).toHaveLength(1);
    const remaining = await fixture.database.getAllAsync<{ status: string }>('SELECT status FROM play_sessions;');
    expect(remaining).toEqual([{ status: 'active' }]);
  });
});
