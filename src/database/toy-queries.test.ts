import { runMigrations } from './migrations';
import { RealSqliteConnection } from './real-sqlite-connection.test-helper';
import { createRoom, createStorageSpot } from '@/repositories/rooms-repository';
import {
  countToys,
  createToy,
  deleteToy,
  getToyWithLocation,
  listSuggestibleToys,
  listToys,
  setToyArchived,
  setToyAvailability,
  updateToy,
  type SaveToyInput,
} from '@/repositories/toys-repository';
import {
  completePlaySession,
  createPlaySession,
  getActivePlaySession,
} from '@/repositories/play-sessions-repository';
import { ensureSettings } from '@/repositories/settings-repository';

/**
 * These exercise the toy and play-session SQL against a real SQLite engine
 * rather than a hand-written fake, so joins, EXISTS filters, LIKE escaping and
 * the partial unique index on active sessions are actually verified.
 */

type Fixture = {
  database: RealSqliteConnection;
  roomId: number;
  otherRoomId: number;
  spotId: number;
  otherSpotId: number;
};

async function setUp(): Promise<Fixture> {
  const database = new RealSqliteConnection();
  await runMigrations(database);
  await ensureSettings(database);
  const room = await createRoom(database, 'Playroom');
  const otherRoom = await createRoom(database, 'Bedroom');
  const spot = await createStorageSpot(database, room.id, 'Blue Bin');
  const otherSpot = await createStorageSpot(database, otherRoom.id, 'Toy Chest');
  return { database, roomId: room.id, otherRoomId: otherRoom.id, spotId: spot.id, otherSpotId: otherSpot.id };
}

function toyInput(fixture: Fixture, overrides: Partial<SaveToyInput> = {}): SaveToyInput {
  return {
    name: 'Magnetic Tiles',
    imageUri: null,
    roomId: fixture.roomId,
    storageSpotId: fixture.spotId,
    isAvailable: true,
    isArchived: false,
    categories: ['building'],
    ...overrides,
  };
}

describe('toy queries against real SQLite', () => {
  let fixture: Fixture;

  beforeEach(async () => {
    fixture = await setUp();
  });

  afterEach(() => {
    fixture.database.close();
  });

  it('joins each toy to its room and storage spot names', async () => {
    const created = await createToy(fixture.database, toyInput(fixture));
    const toy = await getToyWithLocation(fixture.database, created.id);
    expect(toy).toMatchObject({ name: 'Magnetic Tiles', roomName: 'Playroom', storageSpotName: 'Blue Bin' });
    expect(toy?.categories).toEqual(['building']);
  });

  it('filters the library by search text, room and categories together', async () => {
    await createToy(fixture.database, toyInput(fixture, { name: 'Magnetic Tiles', categories: ['building', 'quiet'] }));
    await createToy(fixture.database, toyInput(fixture, { name: 'Rainbow Slinky', categories: ['active'] }));
    await createToy(fixture.database, toyInput(fixture, {
      name: 'Dinosaur Figures',
      roomId: fixture.otherRoomId,
      storageSpotId: fixture.otherSpotId,
      categories: ['pretend'],
    }));

    expect((await listToys(fixture.database, { search: 'rainbow' })).map((toy) => toy.name)).toEqual(['Rainbow Slinky']);
    expect((await listToys(fixture.database, { roomId: fixture.otherRoomId })).map((toy) => toy.name)).toEqual(['Dinosaur Figures']);
    expect((await listToys(fixture.database, { categories: ['building', 'quiet'] })).map((toy) => toy.name)).toEqual(['Magnetic Tiles']);
    expect(await listToys(fixture.database, { categories: ['building', 'active'] })).toEqual([]);
  });

  it('treats LIKE wildcards in a search as literal characters', async () => {
    await createToy(fixture.database, toyInput(fixture, { name: '100% Wool Blocks' }));
    await createToy(fixture.database, toyInput(fixture, { name: 'Plain Blocks' }));

    expect((await listToys(fixture.database, { search: '100%' })).map((toy) => toy.name)).toEqual(['100% Wool Blocks']);
    expect(await listToys(fixture.database, { search: '%_%' })).toEqual([]);
  });

  it('hides archived toys unless they are asked for', async () => {
    const archived = await createToy(fixture.database, toyInput(fixture, { name: 'Retired Puzzle' }));
    await setToyArchived(fixture.database, archived.id, true);
    await createToy(fixture.database, toyInput(fixture, { name: 'Active Puzzle' }));

    expect((await listToys(fixture.database)).map((toy) => toy.name)).toEqual(['Active Puzzle']);
    expect((await listToys(fixture.database, { includeArchived: true })).map((toy) => toy.name)).toEqual(['Active Puzzle', 'Retired Puzzle']);
    expect(await countToys(fixture.database)).toBe(1);
    expect(await countToys(fixture.database, true)).toBe(2);
  });

  it('suggests only available, unarchived toys in the chosen category', async () => {
    const hidden = await createToy(fixture.database, toyInput(fixture, { name: 'Hidden Blocks' }));
    await setToyAvailability(fixture.database, hidden.id, false);
    const archived = await createToy(fixture.database, toyInput(fixture, { name: 'Archived Blocks' }));
    await setToyArchived(fixture.database, archived.id, true);
    await createToy(fixture.database, toyInput(fixture, { name: 'Ready Blocks' }));
    await createToy(fixture.database, toyInput(fixture, { name: 'Ready Paints', categories: ['creative'] }));

    expect((await listSuggestibleToys(fixture.database, 'building', 5)).map((toy) => toy.name)).toEqual(['Ready Blocks']);
    expect((await listSuggestibleToys(fixture.database, null, 5)).map((toy) => toy.name).sort()).toEqual(['Ready Blocks', 'Ready Paints']);
    expect(await listSuggestibleToys(fixture.database, null, 1)).toHaveLength(1);
    expect(await listSuggestibleToys(fixture.database, 'outdoor', 5)).toEqual([]);
  });

  it('replaces the whole category set when a toy is updated', async () => {
    const created = await createToy(fixture.database, toyInput(fixture, { categories: ['building', 'quiet'] }));
    const updated = await updateToy(fixture.database, created.id, toyInput(fixture, { name: 'Renamed', categories: ['sensory'] }));

    expect(updated.name).toBe('Renamed');
    expect(updated.categories).toEqual(['sensory']);
  });

  it('rejects a toy saved without any category', async () => {
    await expect(createToy(fixture.database, toyInput(fixture, { categories: [] }))).rejects.toThrow(
      'A toy must have at least one play category.',
    );
  });

  it('deletes a toy together with its play history', async () => {
    const toy = await createToy(fixture.database, toyInput(fixture));
    const session = await createPlaySession(fixture.database, toy.id);
    await completePlaySession(fixture.database, session.id);

    await deleteToy(fixture.database, toy.id);

    expect(await getToyWithLocation(fixture.database, toy.id)).toBeNull();
    expect(await countToys(fixture.database)).toBe(0);
  });

  it('reports a missing toy rather than silently deleting nothing', async () => {
    await expect(deleteToy(fixture.database, 999)).rejects.toThrow('Toy not found.');
  });
});

describe('play sessions against real SQLite', () => {
  let fixture: Fixture;

  beforeEach(async () => {
    fixture = await setUp();
  });

  afterEach(() => {
    fixture.database.close();
  });

  it('exposes the single active session as the current toy', async () => {
    const toy = await createToy(fixture.database, toyInput(fixture));
    expect(await getActivePlaySession(fixture.database)).toBeNull();

    const session = await createPlaySession(fixture.database, toy.id);
    expect(await getActivePlaySession(fixture.database)).toMatchObject({ id: session.id, toyId: toy.id, status: 'active' });

    await completePlaySession(fixture.database, session.id);
    expect(await getActivePlaySession(fixture.database)).toBeNull();
  });

  it('refuses a second active session while one is open', async () => {
    const first = await createToy(fixture.database, toyInput(fixture, { name: 'First' }));
    const second = await createToy(fixture.database, toyInput(fixture, { name: 'Second' }));
    await createPlaySession(fixture.database, first.id);

    await expect(createPlaySession(fixture.database, second.id)).rejects.toThrow();
  });

  it('will not complete a session twice', async () => {
    const toy = await createToy(fixture.database, toyInput(fixture));
    const session = await createPlaySession(fixture.database, toy.id);
    await completePlaySession(fixture.database, session.id);

    await expect(completePlaySession(fixture.database, session.id)).rejects.toThrow(
      'Active play session could not be completed.',
    );
  });
});
