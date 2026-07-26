import { initializeDatabase, resetDatabaseInitializationForTests } from './client';
import { runMigrations } from './migrations';
import type { DatabaseConnection, SqlParameters, SqlRunResult } from './types';
import { countToysAssignedToRoom, createRoom, createStorageSpot, getRoom } from '@/repositories/rooms-repository';
import { createToy, getToy } from '@/repositories/toys-repository';
import { completePlaySession, createPlaySession } from '@/repositories/play-sessions-repository';
import { ensureSettings, getSettings, updateSettings } from '@/repositories/settings-repository';
import { getStartupDestination } from '@/startup/startup-routing';
import { completeOnboarding } from '@/features/onboarding/complete-onboarding';
import { savePinThenCompleteOnboarding } from '@/features/onboarding/complete-onboarding-flow';
import { DEFAULT_CHOICE_LIMIT, DEFAULT_CLEANUP_REQUIRED, validatePin, validatePinConfirmation, validateRequiredName } from '@/features/onboarding/validation';
import type { PinStorage } from '@/services/pin-storage';
import {
  createParentRoom,
  createParentStorageSpot,
  loadLocationTree,
  removeParentRoom,
  removeParentStorageSpot,
  renameParentRoom,
  renameParentStorageSpot,
  LocationConflictError,
  LocationDeletionBlockedError,
} from '@/features/locations/location-service';

type RecordRow = Record<string, string | number | null>;

class TestDatabase implements DatabaseConnection {
  public version = 0;
  public migrationsApplied = 0;
  public failStorageSpotCreation = false;
  private identifier = 0;
  private readonly rooms = new Map<number, RecordRow>();
  private readonly spots = new Map<number, RecordRow>();
  private readonly toys = new Map<number, RecordRow>();
  private readonly categories = new Map<number, string[]>();
  private readonly sessions = new Map<number, RecordRow>();
  private settings: RecordRow | null = null;

  async execAsync(source: string): Promise<void> {
    if (source.includes('CREATE TABLE')) this.migrationsApplied += 1;
    const match = source.match(/PRAGMA user_version = (\d+);/);
    if (match?.[1]) this.version = Number(match[1]);
  }

  async withTransactionAsync(task: () => Promise<void>): Promise<void> { await task(); }

  async runAsync(source: string, ...params: SqlParameters): Promise<SqlRunResult> {
    const id = (): number => { this.identifier += 1; return this.identifier; };
    if (source.startsWith('INSERT OR IGNORE INTO settings')) { if (!this.settings) this.settings = { id: 1, onboarding_completed: 0, parent_pin: null, child_nickname: null, choice_limit: 3, cleanup_required: 1, created_at: params[1]!, updated_at: params[2]! }; return { lastInsertRowId: 1, changes: 1 }; }
    if (source.startsWith('UPDATE settings')) { if (!this.settings) throw new Error('Missing settings'); [this.settings.onboarding_completed, this.settings.child_nickname, this.settings.choice_limit, this.settings.cleanup_required, this.settings.updated_at] = params; return { lastInsertRowId: 1, changes: 1 }; }
    if (source.startsWith('INSERT INTO rooms')) { const rowId = id(); this.rooms.set(rowId, { id: rowId, name: params[0]!, created_at: params[1]!, updated_at: params[2]! }); return { lastInsertRowId: rowId, changes: 1 }; }
    if (source.startsWith('INSERT INTO storage_spots')) { if (this.failStorageSpotCreation) throw new Error('Storage spot creation failed.'); const rowId = id(); this.spots.set(rowId, { id: rowId, room_id: params[0]!, name: params[1]!, created_at: params[2]!, updated_at: params[3]! }); return { lastInsertRowId: rowId, changes: 1 }; }
    if (source.startsWith('UPDATE rooms')) { const row = this.rooms.get(params[2] as number); if (!row) return { lastInsertRowId: 0, changes: 0 }; row.name = params[0]!; row.updated_at = params[1]!; return { lastInsertRowId: 0, changes: 1 }; }
    if (source.startsWith('UPDATE storage_spots')) { const row = this.spots.get(params[2] as number); if (!row) return { lastInsertRowId: 0, changes: 0 }; row.name = params[0]!; row.updated_at = params[1]!; return { lastInsertRowId: 0, changes: 1 }; }
    if (source.startsWith('DELETE FROM rooms')) { const idToDelete = params[0] as number; const changes = this.rooms.delete(idToDelete) ? 1 : 0; return { lastInsertRowId: 0, changes }; }
    if (source.startsWith('DELETE FROM storage_spots')) { const idToDelete = params[0] as number; const changes = this.spots.delete(idToDelete) ? 1 : 0; return { lastInsertRowId: 0, changes }; }
    if (source.startsWith('INSERT INTO toys')) { const rowId = id(); this.toys.set(rowId, { id: rowId, name: params[0]!, image_uri: params[1]!, room_id: params[2]!, storage_spot_id: params[3]!, is_available: params[4]!, is_archived: params[5]!, created_at: params[6]!, updated_at: params[7]! }); return { lastInsertRowId: rowId, changes: 1 }; }
    if (source.startsWith('INSERT INTO toy_categories')) { const toyId = params[0] as number; this.categories.set(toyId, [...(this.categories.get(toyId) ?? []), params[1] as string]); return { lastInsertRowId: 0, changes: 1 }; }
    if (source.startsWith('INSERT INTO play_sessions')) { const rowId = id(); this.sessions.set(rowId, { id: rowId, toy_id: params[0]!, status: params[1]!, started_at: params[2]!, completed_at: params[3]!, created_at: params[4]!, updated_at: params[5]! }); return { lastInsertRowId: rowId, changes: 1 }; }
    if (source.startsWith('UPDATE play_sessions')) { const session = this.sessions.get(params[3] as number); if (!session || session.status !== 'active') return { lastInsertRowId: 0, changes: 0 }; session.status = params[0]!; session.completed_at = params[1]!; session.updated_at = params[2]!; return { lastInsertRowId: 0, changes: 1 }; }
    throw new Error(`Unhandled SQL: ${source}`);
  }

  async getFirstAsync<T>(source: string, ...params: SqlParameters): Promise<T | null> {
    if (source.startsWith('PRAGMA user_version')) return { user_version: this.version } as T;
    if (source.includes('FROM rooms WHERE name')) {
      const name = String(params[0]).trim().toLowerCase();
      const excluded = params.length > 1 ? params[1] : null;
      const found = [...this.rooms.values()].find((row) => String(row.name).toLowerCase() === name && row.id !== excluded);
      return (found ?? null) as T | null;
    }
    if (source.includes('FROM storage_spots WHERE room_id') && source.includes('name =')) {
      const roomId = params[0]; const name = String(params[1]).trim().toLowerCase(); const excluded = params.length > 2 ? params[2] : null;
      const found = [...this.spots.values()].find((row) => row.room_id === roomId && String(row.name).toLowerCase() === name && row.id !== excluded);
      return (found ?? null) as T | null;
    }
    if (source.includes('COUNT(*) AS count FROM toys WHERE room_id')) return { count: [...this.toys.values()].filter((row) => row.room_id === params[0]).length } as T;
    if (source.includes('COUNT(*) AS count FROM toys WHERE storage_spot_id')) return { count: [...this.toys.values()].filter((row) => row.storage_spot_id === params[0]).length } as T;
    if (source.includes('COUNT(*) AS count FROM storage_spots')) return { count: [...this.spots.values()].filter((row) => row.room_id === params[0]).length } as T;
    if (source.includes('FROM settings')) return this.settings as T | null;
    if (source.includes('FROM rooms')) return (this.rooms.get(params[0] as number) ?? null) as T | null;
    if (source.includes('FROM storage_spots')) return (this.spots.get(params[0] as number) ?? null) as T | null;
    if (source.includes('FROM toys')) return (this.toys.get(params[0] as number) ?? null) as T | null;
    if (source.includes('FROM play_sessions')) return (this.sessions.get(params[0] as number) ?? null) as T | null;
    throw new Error(`Unhandled SQL: ${source}`);
  }

  async getAllAsync<T>(source: string, ...params: SqlParameters): Promise<T[]> {
    if (source.includes('FROM rooms')) return [...this.rooms.values()].sort((left, right) => String(left.name).localeCompare(String(right.name))).map((row) => row as T);
    if (source.includes('FROM storage_spots')) return [...this.spots.values()].filter((row) => row.room_id === params[0]).sort((left, right) => String(left.name).localeCompare(String(right.name))).map((row) => row as T);
    if (source.includes('FROM toy_categories')) return (this.categories.get(params[0] as number) ?? []).map((category) => ({ category }) as T);
    throw new Error(`Unhandled SQL: ${source}`);
  }
}

const mockDatabase = new TestDatabase();

class TestPinStorage implements PinStorage {
  public pin: string | null = null;
  public failSave = false;
  public saveCalls = 0;
  public deleteCalls = 0;

  async savePin(pin: string): Promise<void> {
    this.saveCalls += 1;
    if (this.failSave) throw new Error('PIN storage failed.');
    this.pin = pin;
  }

  async getPin(): Promise<string | null> { return this.pin; }

  async deletePin(): Promise<void> {
    this.deleteCalls += 1;
    this.pin = null;
  }
}

const onboardingInput = { pin: '1234', childNickname: 'Ari', choiceLimit: 3 as const, cleanupRequired: true, roomName: 'Playroom', storageSpotName: 'Blue Bin' };

jest.mock('expo-sqlite', () => ({ openDatabaseAsync: jest.fn(async () => mockDatabase) }));

describe('database foundation', () => {
  beforeEach(() => { resetDatabaseInitializationForTests(); });

  it('initializes a database on first launch', async () => {
    await initializeDatabase();
    expect(mockDatabase.version).toBe(1);
    await expect(getSettings(mockDatabase)).resolves.toMatchObject({ choiceLimit: 3, onboardingCompleted: false });
  });

  it('runs migrations idempotently', async () => {
    const fresh = new TestDatabase();
    await runMigrations(fresh);
    const applied = fresh.migrationsApplied;
    await runMigrations(fresh);
    expect(fresh.migrationsApplied).toBe(applied);
  });

  it('creates and reads rooms and storage spots', async () => {
    const room = await createRoom(mockDatabase, ' Playroom ');
    await expect(getRoom(mockDatabase, room.id)).resolves.toMatchObject({ name: 'Playroom' });
    await expect(createStorageSpot(mockDatabase, room.id, 'Blue Bin')).resolves.toMatchObject({ roomId: room.id, name: 'Blue Bin' });
  });

  it('saves a toy with categories and reads them', async () => {
    const room = await createRoom(mockDatabase, 'Bedroom');
    const spot = await createStorageSpot(mockDatabase, room.id, 'Shelf');
    const toy = await createToy(mockDatabase, { name: 'Blocks', imageUri: 'file:///blocks.jpg', roomId: room.id, storageSpotId: spot.id, isAvailable: true, isArchived: false, categories: ['building', 'creative'] });
    await expect(getToy(mockDatabase, toy.id)).resolves.toMatchObject({ name: 'Blocks', categories: ['building', 'creative'] });
  });

  it('creates and completes a play session', async () => {
    const session = await createPlaySession(mockDatabase, 1);
    await expect(completePlaySession(mockDatabase, session.id)).resolves.toMatchObject({ status: 'completed', completedAt: expect.any(String) });
  });

  it('reads and updates settings', async () => {
    await ensureSettings(mockDatabase);
    await expect(updateSettings(mockDatabase, { childNickname: 'Ari', choiceLimit: 5, onboardingCompleted: true })).resolves.toMatchObject({ childNickname: 'Ari', choiceLimit: 5, onboardingCompleted: true });
  });

  it('completes onboarding and persists its settings', async () => {
    const fresh = new TestDatabase();
    await ensureSettings(fresh);
    await completeOnboarding(fresh, { childNickname: 'Ari', choiceLimit: 5, cleanupRequired: false, roomName: 'Playroom', storageSpotName: 'Blue Bin' });
    await expect(getSettings(fresh)).resolves.toMatchObject({ onboardingCompleted: true, childNickname: 'Ari', choiceLimit: 5, cleanupRequired: false });
  });

  it('does not mark onboarding complete when location creation fails', async () => {
    const fresh = new TestDatabase();
    fresh.failStorageSpotCreation = true;
    await ensureSettings(fresh);
    await expect(completeOnboarding(fresh, { childNickname: 'Ari', choiceLimit: 3, cleanupRequired: true, roomName: 'Playroom', storageSpotName: 'Blue Bin' })).rejects.toThrow('Storage spot creation failed.');
    await expect(getSettings(fresh)).resolves.toMatchObject({ onboardingCompleted: false });
  });

  it('chooses startup destinations from onboarding state', () => {
    const settings = { onboardingCompleted: false, childNickname: null, choiceLimit: 3 as const, cleanupRequired: true, createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z' };
    expect(getStartupDestination(settings)).toBe('/onboarding');
    expect(getStartupDestination({ ...settings, onboardingCompleted: true })).toBe('/parent/home');
  });
});

describe('onboarding validation', () => {
  it('accepts a valid four-digit PIN and rejects invalid values', () => {
    expect(validatePin('1234')).toBeNull();
    expect(validatePin('123')).toBe('Enter a four-digit numeric PIN.');
    expect(validatePin('12a4')).toBe('Enter a four-digit numeric PIN.');
  });

  it('reports a PIN mismatch', () => {
    expect(validatePinConfirmation('1234', '4321')).toBe('The PINs do not match.');
  });

  it('validates child and location names', () => {
    expect(validateRequiredName('  ', 'Child nickname')).toBe('Child nickname is required.');
    expect(validateRequiredName('Room', 'Room name')).toBeNull();
    expect(validateRequiredName('   ', 'Storage spot name')).toBe('Storage spot name is required.');
  });

  it('uses the required onboarding defaults', () => {
    expect(DEFAULT_CHOICE_LIMIT).toBe(3);
    expect(DEFAULT_CLEANUP_REQUIRED).toBe(true);
  });
});

describe('PIN and onboarding completion consistency', () => {
  it('removes a newly stored PIN when SQLite onboarding completion fails', async () => {
    const storage = new TestPinStorage();
    await expect(savePinThenCompleteOnboarding(onboardingInput, storage, async () => { throw new Error('SQLite failed.'); })).rejects.toThrow('SQLite failed.');
    expect(storage.pin).toBeNull();
    expect(storage.deleteCalls).toBe(1);
  });

  it('does not start SQLite onboarding when PIN storage fails', async () => {
    const storage = new TestPinStorage();
    storage.failSave = true;
    const saveOnboarding = jest.fn(async (): Promise<void> => {});
    await expect(savePinThenCompleteOnboarding(onboardingInput, storage, saveOnboarding)).rejects.toThrow('PIN storage failed.');
    expect(saveOnboarding).not.toHaveBeenCalled();
  });

  it('restores an existing PIN if a retried SQLite completion fails', async () => {
    const storage = new TestPinStorage();
    storage.pin = '9999';
    await expect(savePinThenCompleteOnboarding(onboardingInput, storage, async () => { throw new Error('SQLite failed.'); })).rejects.toThrow('SQLite failed.');
    expect(storage.pin).toBe('9999');
    expect(storage.saveCalls).toBe(2);
  });

  it('keeps the PIN only after SQLite onboarding completion succeeds', async () => {
    const storage = new TestPinStorage();
    const saveOnboarding = jest.fn(async (): Promise<void> => {});
    await savePinThenCompleteOnboarding(onboardingInput, storage, saveOnboarding);
    expect(storage.pin).toBe('1234');
    expect(saveOnboarding).toHaveBeenCalledTimes(1);
  });
});

describe('parent location management', () => {
  it('trims names, prevents case-insensitive duplicates, and sorts locations', async () => {
    const database = new TestDatabase();
    const bedroom = await createParentRoom(database, ' Bedroom ');
    const playroom = await createParentRoom(database, 'Playroom');
    await expect(createParentRoom(database, 'playROOM')).rejects.toBeInstanceOf(LocationConflictError);
    await createParentStorageSpot(database, bedroom.id, 'Shelf');
    await createParentStorageSpot(database, bedroom.id, 'Under Bed');
    await expect(createParentStorageSpot(database, bedroom.id, 'shelf')).rejects.toBeInstanceOf(LocationConflictError);
    await expect(createParentStorageSpot(database, playroom.id, 'Shelf')).resolves.toMatchObject({ roomId: playroom.id });
    await expect(loadLocationTree(database)).resolves.toMatchObject([{ name: 'Bedroom', storageSpots: [{ name: 'Shelf' }, { name: 'Under Bed' }] }, { name: 'Playroom' }]);
  });

  it('updates room and storage-spot names while preserving IDs', async () => {
    const database = new TestDatabase();
    const room = await createParentRoom(database, 'Playroom');
    const spot = await createParentStorageSpot(database, room.id, 'Blue Bin');
    await expect(renameParentRoom(database, room.id, ' Main Room ')).resolves.toMatchObject({ id: room.id, name: 'Main Room' });
    await expect(renameParentStorageSpot(database, spot.id, ' Bottom Shelf ')).resolves.toMatchObject({ id: spot.id, roomId: room.id, name: 'Bottom Shelf' });
  });

  it('deletes unused locations and blocks protected deletions', async () => {
    const database = new TestDatabase();
    const emptyRoom = await createParentRoom(database, 'Empty');
    await removeParentRoom(database, emptyRoom.id);
    const room = await createParentRoom(database, 'Playroom');
    const spot = await createParentStorageSpot(database, room.id, 'Bin');
    await expect(removeParentRoom(database, room.id)).rejects.toBeInstanceOf(LocationDeletionBlockedError);
    await removeParentStorageSpot(database, spot.id);
    await removeParentRoom(database, room.id);
  });

  it('blocks deletion when a storage spot or room has an assigned toy', async () => {
    const database = new TestDatabase();
    const room = await createParentRoom(database, 'Playroom');
    const spot = await createParentStorageSpot(database, room.id, 'Bin');
    await createToy(database, { name: 'Blocks', imageUri: null, roomId: room.id, storageSpotId: spot.id, isAvailable: true, isArchived: false, categories: ['building'] });
    await expect(countToysAssignedToRoom(database, room.id)).resolves.toBe(1);
    await expect(removeParentStorageSpot(database, spot.id)).rejects.toThrow('toys are assigned');
    await expect(removeParentRoom(database, room.id)).rejects.toBeInstanceOf(LocationDeletionBlockedError);
  });
});
