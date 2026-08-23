import { LOCAL_HOUSEHOLD_ID, runMigrations } from '@/database/migrations';
import { RealSqliteConnection } from '@/database/real-sqlite-connection.test-helper';
import { ensureSettings } from '@/repositories/settings-repository';
import {
  ChildProfileError,
  addChildProfile,
  clearChildHistory,
  countChildHistory,
  deleteChildProfile,
  describeHistoryDisposition,
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

async function startSession(fixture: Fixture, toyId: number, childId: number | null, status: 'active' | 'completed'): Promise<void> {
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

describe('choosing what happens to a deleted profile\'s play history', () => {
  let fixture: Fixture;

  beforeEach(async () => { fixture = await setUp(); });
  afterEach(() => { fixture.database.close(); });

  it('deletes the records when that is what was asked for', async () => {
    const toyId = await addToy(fixture, 'Magnetic Tiles');
    const maya = await addChildProfile(fixture.database, { name: 'Maya' });
    await startSession(fixture, toyId, maya.id, 'completed');
    await startSession(fixture, toyId, maya.id, 'completed');

    const summary = await deleteChildProfile(fixture.database, maya.id, 'delete');

    expect(summary).toEqual({ removedSessions: 2, anonymisedSessions: 0 });
    expect(await fixture.database.getAllAsync('SELECT id FROM play_sessions;')).toHaveLength(0);
  });

  it('keeps the records and detaches the child when asked to anonymise', async () => {
    const toyId = await addToy(fixture, 'Magnetic Tiles');
    const maya = await addChildProfile(fixture.database, { name: 'Maya' });
    await startSession(fixture, toyId, maya.id, 'completed');
    await startSession(fixture, toyId, maya.id, 'completed');

    const summary = await deleteChildProfile(fixture.database, maya.id, 'anonymise');

    expect(summary).toEqual({ removedSessions: 0, anonymisedSessions: 2 });
    const rows = await fixture.database.getAllAsync<{ child_id: number | null; toy_id: number }>(
      'SELECT child_id, toy_id FROM play_sessions;',
    );
    // The household still knows the toy was played with; nobody's name survives.
    expect(rows).toEqual([{ child_id: null, toy_id: toyId }, { child_id: null, toy_id: toyId }]);
    expect(await fixture.database.getAllAsync('SELECT id FROM child_profiles;')).toHaveLength(0);
  });

  it('ends a session still open rather than leaving a deleted child mid-play', async () => {
    const toyId = await addToy(fixture, 'Magnetic Tiles');
    const maya = await addChildProfile(fixture.database, { name: 'Maya' });
    await startSession(fixture, toyId, maya.id, 'active');

    await deleteChildProfile(fixture.database, maya.id, 'anonymise');

    const rows = await fixture.database.getAllAsync<{ status: string; completed_at: string | null; child_id: number | null }>(
      'SELECT status, completed_at, child_id FROM play_sessions;',
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].status).toBe('completed');
    expect(rows[0].completed_at).toEqual(expect.any(String));
    expect(rows[0].child_id).toBeNull();
  });

  it('does not collide with the household Guest slot when anonymising an open session', async () => {
    const tiles = await addToy(fixture, 'Magnetic Tiles');
    const blocks = await addToy(fixture, 'Wooden Blocks');
    const maya = await addChildProfile(fixture.database, { name: 'Maya' });
    await startSession(fixture, blocks, null, 'active'); // Guest is already playing.
    await startSession(fixture, tiles, maya.id, 'active');

    // Anonymising would make two active Guest sessions, which the household's
    // one-Guest-at-a-time index forbids; completing first is what makes it legal.
    await expect(deleteChildProfile(fixture.database, maya.id, 'anonymise')).resolves.toMatchObject({
      anonymisedSessions: 1,
    });
    const active = await fixture.database.getAllAsync("SELECT id FROM play_sessions WHERE status = 'active';");
    expect(active).toHaveLength(1);
  });

  it('never touches inventory, whichever disposition is chosen', async () => {
    for (const disposition of ['delete', 'anonymise'] as const) {
      const local = await setUp();
      const toyId = await addToy(local, 'Magnetic Tiles');
      const child = await addChildProfile(local.database, { name: 'Sam' });
      await startSession(local, toyId, child.id, 'completed');

      await deleteChildProfile(local.database, child.id, disposition);

      expect(await local.database.getAllAsync('SELECT id FROM toys;')).toHaveLength(1);
      expect(await local.database.getAllAsync('SELECT id FROM rooms;')).toHaveLength(1);
      expect(await local.database.getAllAsync('SELECT id FROM storage_spots;')).toHaveLength(1);
      local.database.close();
    }
  });

  it('defaults to deleting, so an unspecified call cannot silently keep records', async () => {
    const toyId = await addToy(fixture, 'Magnetic Tiles');
    const maya = await addChildProfile(fixture.database, { name: 'Maya' });
    await startSession(fixture, toyId, maya.id, 'completed');

    const summary = await deleteChildProfile(fixture.database, maya.id);

    expect(summary).toEqual({ removedSessions: 1, anonymisedSessions: 0 });
  });

  it('counts the history so the choice can be made knowing what is at stake', async () => {
    const toyId = await addToy(fixture, 'Magnetic Tiles');
    const maya = await addChildProfile(fixture.database, { name: 'Maya' });
    expect(await countChildHistory(fixture.database, maya.id)).toBe(0);
    await startSession(fixture, toyId, maya.id, 'completed');
    expect(await countChildHistory(fixture.database, maya.id)).toBe(1);
  });

  it('describes each choice in terms of what a parent loses or keeps', () => {
    expect(describeHistoryDisposition('delete', 0)).toBe('This profile has no play history yet.');
    expect(describeHistoryDisposition('delete', 1)).toBe('1 play record will be deleted.');
    expect(describeHistoryDisposition('delete', 4)).toBe('4 play records will be deleted.');
    expect(describeHistoryDisposition('anonymise', 4))
      .toBe("4 play records will be kept for the household, with this child's name removed.");
  });
});

describe('household isolation and rapid taps', () => {
  const OTHER_HOUSEHOLD_ID = 'household-two';
  let fixture: Fixture;

  beforeEach(async () => {
    fixture = await setUp();
    await fixture.database.runAsync(
      "INSERT INTO households (id, name, created_at, updated_at) VALUES (?, 'Next door', '2026-01-01', '2026-01-01');",
      OTHER_HOUSEHOLD_ID,
    );
  });

  afterEach(() => {
    fixture.database.close();
  });

  it('lets two households each have a child with the same name', async () => {
    await addChildProfile(fixture.database, { name: 'Maya' }, LOCAL_HOUSEHOLD_ID);
    await expect(
      addChildProfile(fixture.database, { name: 'Maya' }, OTHER_HOUSEHOLD_ID),
    ).resolves.toEqual(expect.objectContaining({ name: 'Maya' }));
  });

  it('never lists another household\'s profiles', async () => {
    await addChildProfile(fixture.database, { name: 'Maya' }, LOCAL_HOUSEHOLD_ID);
    await addChildProfile(fixture.database, { name: 'Rosa' }, OTHER_HOUSEHOLD_ID);

    const ours = await loadChildProfiles(fixture.database, { householdId: LOCAL_HOUSEHOLD_ID });
    const theirs = await loadChildProfiles(fixture.database, { householdId: OTHER_HOUSEHOLD_ID });

    expect(ours.map((profile) => profile.name)).toEqual(['Maya']);
    expect(theirs.map((profile) => profile.name)).toEqual(['Rosa']);
  });

  it('leaves the other household untouched when a profile is deleted', async () => {
    const ours = await addChildProfile(fixture.database, { name: 'Maya' }, LOCAL_HOUSEHOLD_ID);
    await addChildProfile(fixture.database, { name: 'Rosa' }, OTHER_HOUSEHOLD_ID);

    await deleteChildProfile(fixture.database, ours.id);

    const theirs = await loadChildProfiles(fixture.database, { householdId: OTHER_HOUSEHOLD_ID });
    expect(theirs.map((profile) => profile.name)).toEqual(['Rosa']);
  });

  it('does not reorder one household using another household\'s ids', async () => {
    const first = await addChildProfile(fixture.database, { name: 'Maya' }, LOCAL_HOUSEHOLD_ID);
    const second = await addChildProfile(fixture.database, { name: 'Sam' }, LOCAL_HOUSEHOLD_ID);
    const outsider = await addChildProfile(fixture.database, { name: 'Rosa' }, OTHER_HOUSEHOLD_ID);

    const reordered = await reorderChildren(
      fixture.database,
      [outsider.id, second.id, first.id],
      LOCAL_HOUSEHOLD_ID,
    );

    expect(reordered.map((profile) => profile.name)).toEqual(['Sam', 'Maya']);
  });

  it('creates one profile, not two, when the same add is tapped twice at once', async () => {
    const results = await Promise.allSettled([
      addChildProfile(fixture.database, { name: 'Maya' }, LOCAL_HOUSEHOLD_ID),
      addChildProfile(fixture.database, { name: 'Maya' }, LOCAL_HOUSEHOLD_ID),
    ]);

    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    const profiles = await loadChildProfiles(fixture.database, { householdId: LOCAL_HOUSEHOLD_ID });
    expect(profiles).toHaveLength(1);
  });

  it('survives a repeated delete of the same profile', async () => {
    const profile = await addChildProfile(fixture.database, { name: 'Maya' }, LOCAL_HOUSEHOLD_ID);
    const toyId = await addToy(fixture, 'Blocks');
    await startSession(fixture, toyId, profile.id, 'completed');

    const first = await deleteChildProfile(fixture.database, profile.id, 'anonymise');
    expect(first).toEqual({ removedSessions: 0, anonymisedSessions: 1 });

    // A replayed delete says so rather than reporting a second anonymisation,
    // and must not touch the records the first one detached.
    await expect(deleteChildProfile(fixture.database, profile.id, 'anonymise')).rejects.toThrow(
      ChildProfileError,
    );
    const sessions = await fixture.database.getAllAsync<{ child_id: number | null }>(
      'SELECT child_id FROM play_sessions;',
    );
    expect(sessions).toEqual([{ child_id: null }]);
  });
});

/**
 * The database is the final arbiter of name uniqueness, so it has to agree
 * with the service's own check for every input the service would reject —
 * not just for ordinary names.
 */
describe('the stored normalised name', () => {
  let fixture: Fixture;

  beforeEach(async () => {
    fixture = await setUp();
  });

  afterEach(() => {
    fixture.database.close();
  });

  const sameNameAs = (variant: string) => async () => {
    await addChildProfile(fixture.database, { name: 'Sam Smith' }, LOCAL_HOUSEHOLD_ID);
    await expect(addChildProfile(fixture.database, { name: variant }, LOCAL_HOUSEHOLD_ID)).rejects.toThrow(
      'There is already a profile with that name.',
    );
  };

  it('rejects a different casing', sameNameAs('SAM SMITH'));
  it('rejects surrounding whitespace', sameNameAs('   Sam Smith\t'));
  it('rejects a tab as the separator', sameNameAs('Sam\tSmith'));
  it('rejects a run of spaces longer than eight', sameNameAs(`Sam${' '.repeat(40)}Smith`));

  it('is written for every profile, including after a rename', async () => {
    const profile = await addChildProfile(fixture.database, { name: '  Sam   Smith ' }, LOCAL_HOUSEHOLD_ID);
    let row = await fixture.database.getFirstAsync<{ normalized_name: string }>(
      'SELECT normalized_name FROM child_profiles WHERE id = ?;',
      profile.id,
    );
    expect(row?.normalized_name).toBe('sam smith');

    await saveChildProfile(fixture.database, profile.id, { name: 'Rosa\tLee' });
    row = await fixture.database.getFirstAsync<{ normalized_name: string }>(
      'SELECT normalized_name FROM child_profiles WHERE id = ?;',
      profile.id,
    );
    expect(row?.normalized_name).toBe('rosa lee');
  });

  it('still lets two households use the same name', async () => {
    await fixture.database.runAsync(
      "INSERT INTO households (id, name, created_at, updated_at) VALUES ('household-two', 'Next door', '2026-01-01', '2026-01-01');",
    );
    await addChildProfile(fixture.database, { name: 'Sam\tSmith' }, LOCAL_HOUSEHOLD_ID);
    await expect(
      addChildProfile(fixture.database, { name: 'SAM   SMITH' }, 'household-two'),
    ).resolves.toEqual(expect.objectContaining({ name: 'SAM SMITH' }));
  });

  it('is enforced by the database, not only by the service check', async () => {
    await addChildProfile(fixture.database, { name: 'Sam Smith' }, LOCAL_HOUSEHOLD_ID);
    // Bypasses the service entirely, the way a concurrent insert does.
    await expect(
      fixture.database.runAsync(
        `INSERT INTO child_profiles
           (name, normalized_name, household_id, avatar_id, accent_color_id, choice_limit, reading_support, display_order, created_at, updated_at)
         VALUES ('SAM  SMITH', 'sam smith', ?, 'circle-dot', 'mint', 3, 'pictures-words', 2, '2026-01-01', '2026-01-01');`,
        LOCAL_HOUSEHOLD_ID,
      ),
    ).rejects.toThrow(/UNIQUE/i);
  });
});

describe('what a name looks like once it is saved', () => {
  let fixture: Fixture;

  beforeEach(async () => { fixture = await setUp(); });
  afterEach(() => { fixture.database.close(); });

  it('stores a name without the gap a stray double space leaves', async () => {
    const profile = await addChildProfile(fixture.database, { name: `Sam${' '.repeat(12)}Smith` }, LOCAL_HOUSEHOLD_ID);
    expect(profile.name).toBe('Sam Smith');
  });

  it('collapses on rename too', async () => {
    const profile = await addChildProfile(fixture.database, { name: 'Maya' }, LOCAL_HOUSEHOLD_ID);
    const renamed = await saveChildProfile(fixture.database, profile.id, { name: '  Rosa   Lee ' });
    expect(renamed.name).toBe('Rosa Lee');
  });

  it('keeps the capitalisation a parent chose', async () => {
    const profile = await addChildProfile(fixture.database, { name: 'saM   SMITH' }, LOCAL_HOUSEHOLD_ID);
    expect(profile.name).toBe('saM SMITH');
  });
});
