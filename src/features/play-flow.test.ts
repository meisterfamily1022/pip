import { runMigrations } from '@/database/migrations';
import { RealSqliteConnection } from '@/database/real-sqlite-connection.test-helper';
import { PLAY_CATEGORIES, playCategoryLabel } from '@/domain/play-category';
import { ANYTHING_CHOICE_ID, PLAY_CHOICES, findPlayChoice } from '@/features/play/play-choices';
import {
  finishPlaying,
  isCleanupRequired,
  loadCurrentToy,
  loadSuggestions,
  startPlayingWith,
} from '@/features/play/play-service';
import { changeParentPin, verifyParentPin } from '@/features/parent-access/parent-pin';
import { createRoom, createStorageSpot } from '@/repositories/rooms-repository';
import { getActivePlaySession } from '@/repositories/play-sessions-repository';
import { ensureSettings, updateSettings } from '@/repositories/settings-repository';
import { createToy, type SaveToyInput } from '@/repositories/toys-repository';
import type { PinStorage } from '@/services/pin-storage';

type Fixture = { database: RealSqliteConnection; roomId: number; spotId: number };

async function setUp(): Promise<Fixture> {
  const database = new RealSqliteConnection();
  await runMigrations(database);
  await ensureSettings(database);
  const room = await createRoom(database, 'Playroom');
  const spot = await createStorageSpot(database, room.id, 'Blue Bin');
  return { database, roomId: room.id, spotId: spot.id };
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

describe('play choices', () => {
  it('offers every stored play category exactly once, plus "show me anything"', () => {
    const mapped = PLAY_CHOICES.map((choice) => choice.category).filter((category) => category !== null);
    expect([...mapped].sort()).toEqual([...PLAY_CATEGORIES].sort());
    expect(PLAY_CHOICES.filter((choice) => choice.category === null)).toHaveLength(1);
  });

  it('resolves a choice id and falls back to "show me anything"', () => {
    expect(findPlayChoice('build').category).toBe('building');
    expect(findPlayChoice('solo').category).toBe('independent');
    expect(findPlayChoice(undefined).id).toBe(ANYTHING_CHOICE_ID);
    expect(findPlayChoice('not-a-choice').category).toBeNull();
  });

  it('labels every category for the parent library', () => {
    for (const category of PLAY_CATEGORIES) expect(playCategoryLabel(category)).toBeTruthy();
  });
});

describe('play service', () => {
  let fixture: Fixture;

  beforeEach(async () => {
    fixture = await setUp();
  });

  afterEach(() => {
    fixture.database.close();
  });

  it('caps suggestions at the choice limit the parent configured', async () => {
    for (const name of ['Blocks A', 'Blocks B', 'Blocks C', 'Blocks D', 'Blocks E']) {
      await createToy(fixture.database, toyInput(fixture, { name }));
    }

    await updateSettings(fixture.database, { choiceLimit: 1 });
    expect(await loadSuggestions(fixture.database, 'building')).toHaveLength(1);

    await updateSettings(fixture.database, { choiceLimit: 3 });
    expect(await loadSuggestions(fixture.database, 'building')).toHaveLength(3);

    await updateSettings(fixture.database, { choiceLimit: 5 });
    expect(await loadSuggestions(fixture.database, null)).toHaveLength(5);
  });

  it('makes a chosen toy current and reports where it is stored', async () => {
    const toy = await createToy(fixture.database, toyInput(fixture));

    await startPlayingWith(fixture.database, toy.id);

    const current = await loadCurrentToy(fixture.database);
    expect(current?.toy).toMatchObject({ name: 'Magnetic Tiles', roomName: 'Playroom', storageSpotName: 'Blue Bin' });
    expect(current?.session.status).toBe('active');
  });

  it('closes the previous session when a second toy is chosen', async () => {
    const first = await createToy(fixture.database, toyInput(fixture, { name: 'First' }));
    const second = await createToy(fixture.database, toyInput(fixture, { name: 'Second' }));

    await startPlayingWith(fixture.database, first.id);
    await startPlayingWith(fixture.database, second.id);

    const current = await loadCurrentToy(fixture.database);
    expect(current?.toy.name).toBe('Second');
  });

  it('has no current toy before anything is chosen or after cleanup', async () => {
    expect(await loadCurrentToy(fixture.database)).toBeNull();

    const toy = await createToy(fixture.database, toyInput(fixture));
    await startPlayingWith(fixture.database, toy.id);
    await finishPlaying(fixture.database);

    expect(await loadCurrentToy(fixture.database)).toBeNull();
    expect(await getActivePlaySession(fixture.database)).toBeNull();
  });

  it('treats finishing with nothing active as a no-op', async () => {
    await expect(finishPlaying(fixture.database)).resolves.toBeUndefined();
  });

  it('reads the cleanup requirement from settings', async () => {
    await updateSettings(fixture.database, { cleanupRequired: true });
    expect(await isCleanupRequired(fixture.database)).toBe(true);

    await updateSettings(fixture.database, { cleanupRequired: false });
    expect(await isCleanupRequired(fixture.database)).toBe(false);
  });
});

describe('parent PIN', () => {
  const storageWith = (initial: string | null): PinStorage & { current: string | null } => ({
    current: initial,
    async savePin(pin: string) {
      this.current = pin;
    },
    async getPin() {
      return this.current;
    },
    async deletePin() {
      this.current = null;
    },
  });

  it('accepts only the stored PIN', async () => {
    const storage = storageWith('1234');
    expect(await verifyParentPin('1234', storage)).toBe(true);
    expect(await verifyParentPin('9999', storage)).toBe(false);
  });

  it('refuses every PIN when none has been set', async () => {
    expect(await verifyParentPin('1234', storageWith(null))).toBe(false);
  });

  it('changes the PIN once the current one is confirmed', async () => {
    const storage = storageWith('1234');
    await changeParentPin('1234', '5678', '5678', storage);
    expect(storage.current).toBe('5678');
  });

  it('rejects a wrong current PIN, a malformed new PIN and a mismatch', async () => {
    const storage = storageWith('1234');
    await expect(changeParentPin('0000', '5678', '5678', storage)).rejects.toThrow('current PIN is not correct');
    await expect(changeParentPin('1234', '12', '12', storage)).rejects.toThrow('four-digit');
    await expect(changeParentPin('1234', '5678', '8765', storage)).rejects.toThrow('do not match');
    expect(storage.current).toBe('1234');
  });
});
