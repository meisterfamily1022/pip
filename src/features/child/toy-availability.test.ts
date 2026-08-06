import { LOCAL_HOUSEHOLD_ID, runMigrations } from '@/database/migrations';
import { RealSqliteConnection } from '@/database/real-sqlite-connection.test-helper';
import { ensureSettings } from '@/repositories/settings-repository';
import {
  listChildToys,
  setToyAvailabilityScope,
  setToyChildVisibility,
  type ToyAvailabilityScope,
} from '@/repositories/toys-repository';

/**
 * Availability is enforced in the query, not the interface.
 *
 * These call the repository directly, which is exactly the bypass a stale
 * screen would represent: if a rule only existed in the UI, every one of these
 * would fail.
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

async function addToy(fixture: Fixture, name: string, scope: ToyAvailabilityScope = 'everyone'): Promise<number> {
  await fixture.database.runAsync(
    `INSERT INTO toys (name, room_id, storage_spot_id, household_id, availability_scope, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, '2026-01-01', '2026-01-01');`,
    name,
    fixture.roomId,
    fixture.spotId,
    LOCAL_HOUSEHOLD_ID,
    scope,
  );
  const row = await fixture.database.getFirstAsync<{ id: number }>('SELECT id FROM toys WHERE name = ?;', name);
  await fixture.database.runAsync(
    "INSERT INTO toy_categories (toy_id, category, created_at) VALUES (?, 'quiet', '2026-01-01');",
    row!.id,
  );
  return row!.id;
}

async function addChild(fixture: Fixture, name: string): Promise<number> {
  await fixture.database.runAsync(
    'INSERT INTO child_profiles (name, household_id, created_at, updated_at) VALUES (?, ?, ' +
      "'2026-01-01', '2026-01-01');",
    name,
    LOCAL_HOUSEHOLD_ID,
  );
  const row = await fixture.database.getFirstAsync<{ id: number }>('SELECT id FROM child_profiles WHERE name = ?;', name);
  return row!.id;
}

const names = (toys: { name: string }[]): string[] => toys.map((toy) => toy.name).sort();

describe('toy availability in Child Mode', () => {
  let fixture: Fixture;

  beforeEach(async () => {
    fixture = await setUp();
  });

  afterEach(() => {
    fixture.database.close();
  });

  it('offers everyone-scoped toys to a named child and to Guest', async () => {
    await addToy(fixture, 'Blocks');
    const maya = await addChild(fixture, 'Maya');

    expect(names(await listChildToys(fixture.database, { childId: maya }))).toEqual(['Blocks']);
    expect(names(await listChildToys(fixture.database, { childId: null }))).toEqual(['Blocks']);
  });

  it('never offers a parent-only toy to anyone', async () => {
    await addToy(fixture, 'Scissors', 'parent_only');
    const maya = await addChild(fixture, 'Maya');

    expect(await listChildToys(fixture.database, { childId: maya })).toEqual([]);
    expect(await listChildToys(fixture.database, { childId: null })).toEqual([]);
  });

  it('never offers a temporarily unavailable toy', async () => {
    await addToy(fixture, 'Puzzle', 'temporarily_unavailable');
    const maya = await addChild(fixture, 'Maya');

    expect(await listChildToys(fixture.database, { childId: maya })).toEqual([]);
  });

  it('offers a selected toy only to the children it was chosen for', async () => {
    const toyId = await addToy(fixture, 'Paints', 'selected');
    const maya = await addChild(fixture, 'Maya');
    const sam = await addChild(fixture, 'Sam');

    await setToyChildVisibility(fixture.database, toyId, [maya]);

    expect(names(await listChildToys(fixture.database, { childId: maya }))).toEqual(['Paints']);
    expect(await listChildToys(fixture.database, { childId: sam })).toEqual([]);
  });

  it('never offers a selected toy to Guest, who is nobody\'s selected child', async () => {
    const toyId = await addToy(fixture, 'Paints', 'selected');
    const maya = await addChild(fixture, 'Maya');
    await setToyChildVisibility(fixture.database, toyId, [maya]);

    expect(await listChildToys(fixture.database, { childId: null })).toEqual([]);
  });

  it('replaces the visible-to list rather than adding to it', async () => {
    const toyId = await addToy(fixture, 'Paints', 'selected');
    const maya = await addChild(fixture, 'Maya');
    const sam = await addChild(fixture, 'Sam');

    await setToyChildVisibility(fixture.database, toyId, [maya]);
    await setToyChildVisibility(fixture.database, toyId, [sam]);

    expect(await listChildToys(fixture.database, { childId: maya })).toEqual([]);
    expect(names(await listChildToys(fixture.database, { childId: sam }))).toEqual(['Paints']);
  });

  it('tolerates the same child being listed twice', async () => {
    const toyId = await addToy(fixture, 'Paints', 'selected');
    const maya = await addChild(fixture, 'Maya');

    await expect(setToyChildVisibility(fixture.database, toyId, [maya, maya])).resolves.toBeUndefined();
    expect(names(await listChildToys(fixture.database, { childId: maya }))).toEqual(['Paints']);
  });

  it('still honours hidden and archived toys', async () => {
    const hidden = await addToy(fixture, 'Hidden');
    const archived = await addToy(fixture, 'Archived');
    await fixture.database.runAsync('UPDATE toys SET is_available = 0 WHERE id = ?;', hidden);
    await fixture.database.runAsync('UPDATE toys SET is_archived = 1 WHERE id = ?;', archived);
    await addToy(fixture, 'Visible');

    expect(names(await listChildToys(fixture.database, { childId: null }))).toEqual(['Visible']);
  });

  it("keeps a toy in another child's active session out of the list", async () => {
    const toyId = await addToy(fixture, 'Blocks');
    const maya = await addChild(fixture, 'Maya');
    const sam = await addChild(fixture, 'Sam');

    await fixture.database.runAsync(
      `INSERT INTO play_sessions (child_id, toy_id, status, started_at, household_id, created_at, updated_at)
       VALUES (?, ?, 'active', '2026-01-01', ?, '2026-01-01', '2026-01-01');`,
      maya,
      toyId,
      LOCAL_HOUSEHOLD_ID,
    );

    // One physical toy cannot be in two places, so Sam is not offered it.
    expect(await listChildToys(fixture.database, { childId: sam })).toEqual([]);
  });

  it('changes what is offered when the parent changes the scope', async () => {
    const toyId = await addToy(fixture, 'Blocks');
    const maya = await addChild(fixture, 'Maya');

    expect(names(await listChildToys(fixture.database, { childId: maya }))).toEqual(['Blocks']);

    await setToyAvailabilityScope(fixture.database, toyId, 'parent_only');
    expect(await listChildToys(fixture.database, { childId: maya })).toEqual([]);

    await setToyAvailabilityScope(fixture.database, toyId, 'everyone');
    expect(names(await listChildToys(fixture.database, { childId: maya }))).toEqual(['Blocks']);
  });

  it('rejects setting a scope on a toy that does not exist', async () => {
    await expect(setToyAvailabilityScope(fixture.database, 4242, 'everyone')).rejects.toThrow('Toy not found.');
  });

  it('defaults to Guest when no audience is given', async () => {
    const toyId = await addToy(fixture, 'Paints', 'selected');
    const maya = await addChild(fixture, 'Maya');
    await setToyChildVisibility(fixture.database, toyId, [maya]);
    await addToy(fixture, 'Blocks');

    // The default audience must be the most restrictive one, not the most open.
    expect(names(await listChildToys(fixture.database))).toEqual(['Blocks']);
  });
});
