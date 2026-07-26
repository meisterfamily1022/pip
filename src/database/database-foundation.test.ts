import { initializeDatabase, resetDatabaseInitializationForTests } from './client';
import { runMigrations } from './migrations';
import type { DatabaseConnection, SqlParameters, SqlRunResult } from './types';
import { createRoom, createStorageSpot, getRoom } from '@/repositories/rooms-repository';
import { createToy, getToy } from '@/repositories/toys-repository';
import { completePlaySession, createPlaySession } from '@/repositories/play-sessions-repository';
import { ensureSettings, getSettings, updateSettings } from '@/repositories/settings-repository';
import { getStartupDestination } from '@/startup/startup-routing';
import { completeOnboarding } from '@/features/onboarding/complete-onboarding';
import { savePinThenCompleteOnboarding } from '@/features/onboarding/complete-onboarding-flow';
import { DEFAULT_CHOICE_LIMIT, DEFAULT_CLEANUP_REQUIRED, validatePin, validatePinConfirmation, validateRequiredName } from '@/features/onboarding/validation';
import type { PinStorage } from '@/services/pin-storage';

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
    if (source.startsWith('INSERT INTO toys')) { const rowId = id(); this.toys.set(rowId, { id: rowId, name: params[0]!, image_uri: params[1]!, room_id: params[2]!, storage_spot_id: params[3]!, is_available: params[4]!, is_archived: params[5]!, created_at: params[6]!, updated_at: params[7]! }); return { lastInsertRowId: rowId, changes: 1 }; }
    if (source.startsWith('INSERT INTO toy_categories')) { const toyId = params[0] as number; this.categories.set(toyId, [...(this.categories.get(toyId) ?? []), params[1] as string]); return { lastInsertRowId: 0, changes: 1 }; }
    if (source.startsWith('INSERT INTO play_sessions')) { const rowId = id(); this.sessions.set(rowId, { id: rowId, toy_id: params[0]!, status: params[1]!, started_at: params[2]!, completed_at: params[3]!, created_at: params[4]!, updated_at: params[5]! }); return { lastInsertRowId: rowId, changes: 1 }; }
    if (source.startsWith('UPDATE play_sessions')) { const session = this.sessions.get(params[3] as number); if (!session || session.status !== 'active') return { lastInsertRowId: 0, changes: 0 }; session.status = params[0]!; session.completed_at = params[1]!; session.updated_at = params[2]!; return { lastInsertRowId: 0, changes: 1 }; }
    throw new Error(`Unhandled SQL: ${source}`);
  }

  async getFirstAsync<T>(source: string, ...params: SqlParameters): Promise<T | null> {
    if (source.startsWith('PRAGMA user_version')) return { user_version: this.version } as T;
    if (source.includes('FROM settings')) return this.settings as T | null;
    if (source.includes('FROM rooms')) return (this.rooms.get(params[0] as number) ?? null) as T | null;
    if (source.includes('FROM storage_spots')) return (this.spots.get(params[0] as number) ?? null) as T | null;
    if (source.includes('FROM toys')) return (this.toys.get(params[0] as number) ?? null) as T | null;
    if (source.includes('FROM play_sessions')) return (this.sessions.get(params[0] as number) ?? null) as T | null;
    throw new Error(`Unhandled SQL: ${source}`);
  }

  async getAllAsync<T>(source: string, ...params: SqlParameters): Promise<T[]> {
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
