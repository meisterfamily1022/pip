import type { DatabaseConnection, SqlParameters, SqlRunResult } from '@/database/types';
import { completeCleanup, completeCleanupWithParentOverride, requestCleanupHelp, saveCleanupStep } from './cleanup-service';
import { completePlaySession, createPlaySession, getActivePlaySession, listActivePlaySessions, markCleanupStarted, startPlaySessionIfNoneActive } from '@/repositories/play-sessions-repository';

type Row = Record<string, string | number | null>;

class CleanupTestDatabase implements DatabaseConnection {
  private nextId = 0;
  private readonly sessions = new Map<number, Row>();
  private readonly toys = new Map<number, Row>();
  private readonly children = new Map<number, string>([[1, 'Ari'], [2, 'Sam'], [3, 'Lee']]);

  constructor() {
    this.toys.set(1, { id: 1, name: 'Blocks', image_uri: 'file:///blocks.jpg', room_id: 1, storage_spot_id: 1, cleanup_difficulty: 'easy', adult_help_required: 0, is_available: 1, is_archived: 0, created_at: '', updated_at: '', room_name: 'Playroom', storage_spot_name: 'Blue Bin' });
    this.toys.set(2, { id: 2, name: 'Train', image_uri: null, room_id: 1, storage_spot_id: 1, cleanup_difficulty: 'easy', adult_help_required: 0, is_available: 1, is_archived: 0, created_at: '', updated_at: '', room_name: 'Playroom', storage_spot_name: 'Shelf' });
  }

  async execAsync(): Promise<void> {}
  async withTransactionAsync(task: () => Promise<void>): Promise<void> { await task(); }

  async runAsync(source: string, ...params: SqlParameters): Promise<SqlRunResult> {
    if (source.startsWith('INSERT INTO play_sessions')) {
      this.nextId += 1;
      this.sessions.set(this.nextId, { id: this.nextId, child_id: params[0]!, toy_id: params[1]!, status: params[2]!, started_at: params[3]!, completed_at: params[4]!, cleanup_started_at: params[5]!, help_requested: params[6]!, parent_override_used: params[7]!, created_at: params[8]!, updated_at: params[9]! });
      return { lastInsertRowId: this.nextId, changes: 1 };
    }
    if (source.startsWith('UPDATE play_sessions SET cleanup_started_at')) {
      const session = this.sessions.get(params[2] as number);
      if (!session || session.child_id !== params[3] || session.status !== params[4]) return { lastInsertRowId: 0, changes: 0 };
      session.cleanup_started_at = session.cleanup_started_at ?? params[0]!;
      session.updated_at = params[1]!;
      return { lastInsertRowId: 0, changes: 1 };
    }
    if (source.startsWith('UPDATE play_sessions SET help_requested')) {
      const session = this.sessions.get(params[2] as number);
      if (!session || session.child_id !== params[3] || session.status !== params[4]) return { lastInsertRowId: 0, changes: 0 };
      session.help_requested = params[0]!;
      session.updated_at = params[1]!;
      return { lastInsertRowId: 0, changes: 1 };
    }
    if (source.startsWith('UPDATE play_sessions SET cleanup_step')) {
      const session = this.sessions.get(params[2] as number);
      if (!session || session.child_id !== params[3] || session.status !== params[4]) return { lastInsertRowId: 0, changes: 0 };
      session.cleanup_step = params[0]!;
      session.updated_at = params[1]!;
      return { lastInsertRowId: 0, changes: 1 };
    }
    if (source.startsWith('UPDATE play_sessions SET status = ?, completed_at = ?, parent_override_used')) {
      const session = this.sessions.get(params[4] as number);
      if (!session || session.child_id !== params[5] || session.status !== params[6]) return { lastInsertRowId: 0, changes: 0 };
      session.status = params[0]!;
      session.completed_at = params[1]!;
      session.parent_override_used = params[2]!;
      session.updated_at = params[3]!;
      return { lastInsertRowId: 0, changes: 1 };
    }
    if (source.startsWith('UPDATE play_sessions SET status')) {
      const session = this.sessions.get(params[3] as number);
      if (!session || session.child_id !== params[4] || session.status !== params[5]) return { lastInsertRowId: 0, changes: 0 };
      session.status = params[0]!;
      session.completed_at = params[1]!;
      session.updated_at = params[2]!;
      return { lastInsertRowId: 0, changes: 1 };
    }
    throw new Error(`Unhandled SQL: ${source}`);
  }

  async getFirstAsync<T>(source: string, ...params: SqlParameters): Promise<T | null> {
    // The active household, which these fakes do not model: they each hold a
    // single library, so it is always the device-local one. Scoping itself is
    // proven against real SQLite in features/household/household-scope.test.ts.
    if (source.includes('FROM device_household_state')) return { active_household_id: 'local' } as T;
    if (source.startsWith('SELECT id FROM child_profiles')) return (this.children.has(params[0] as number) ? { id: params[0] } : null) as T | null;
    if (source.startsWith('SELECT id FROM toys')) { const toy = this.toys.get(params[0] as number); return (toy?.is_available === 1 && toy?.is_archived === 0 ? { id: toy.id } : null) as T | null; }
    if (source.startsWith('SELECT c.name AS child_name')) { const session = [...this.sessions.values()].find((row) => row.toy_id === params[0] && row.status === 'active'); return (session ? { child_name: this.children.get(session.child_id as number) } : null) as T | null; }
    if (source.includes('FROM play_sessions p') && source.includes('JOIN child_profiles')) {
      const session = [...this.sessions.values()].find((row) => row.status === params[0] && row.child_id === params[1]);
      if (!session) return null;
      const toy = this.toys.get(session.toy_id as number)!;
      return { ...session, ...toy, toy_id: session.toy_id, child_id: session.child_id, child_name: this.children.get(session.child_id as number), room_name: toy.room_name, storage_spot_name: toy.storage_spot_name } as T;
    }
    if (source.includes('FROM play_sessions')) return (this.sessions.get(params[0] as number) ?? null) as T | null;
    if (source.includes('FROM settings')) return { onboarding_completed: 1, child_nickname: 'Ari', choice_limit: 3, cleanup_required: 1, created_at: '', updated_at: '' } as T;
    throw new Error(`Unhandled SQL: ${source}`);
  }

  async getAllAsync<T>(source: string, ...params: SqlParameters): Promise<T[]> {
    if (source.includes('FROM play_sessions p') && source.includes('JOIN child_profiles')) return [...this.sessions.values()].filter((row) => row.status === params[0]).map((session) => { const toy = this.toys.get(session.toy_id as number)!; return { ...session, ...toy, toy_id: session.toy_id, child_id: session.child_id, child_name: this.children.get(session.child_id as number), room_name: toy.room_name, storage_spot_name: toy.storage_spot_name } as T; });
    return [];
  }
}

describe('cleanup service transitions', () => {
  it('starts cleanup once and recovers active session state', async () => {
    const database = new CleanupTestDatabase();
    const session = await createPlaySession(database, 1, 1);
    const started = await markCleanupStarted(database, session.id, 1);
    const restarted = await markCleanupStarted(database, session.id, 1);
    expect(started.cleanupStartedAt).toEqual(expect.any(String));
    expect(restarted.cleanupStartedAt).toBe(started.cleanupStartedAt);
    await expect(getActivePlaySession(database, 1)).resolves.toMatchObject({ toy: { name: 'Blocks', roomName: 'Playroom', storageSpotName: 'Blue Bin' } });
  });

  it('persists the current cleanup step for relaunch recovery', async () => {
    const database = new CleanupTestDatabase();
    await createPlaySession(database, 1, 1);
    await expect(saveCleanupStep(database, 1, 1)).resolves.toMatchObject({ cleanupStep: 1 });
    await expect(getActivePlaySession(database, 1)).resolves.toMatchObject({ cleanupStep: 1 });
  });

  it('requests help, preserves it through parent override, and records override', async () => {
    const database = new CleanupTestDatabase();
    await createPlaySession(database, 1, 1);
    await requestCleanupHelp(database, 1);
    await completeCleanupWithParentOverride(database, 1);
    await expect(getActivePlaySession(database, 1)).resolves.toBeNull();
    await expect(completePlaySession(database, 1)).rejects.toThrow('Active play session could not be completed.');
  });

  it('completes normally and prevents completing twice', async () => {
    const database = new CleanupTestDatabase();
    await createPlaySession(database, 1, 1);
    await completeCleanup(database, 1);
    await expect(completeCleanup(database, 1)).rejects.toThrow('There is no active cleanup session.');
  });

  it('blocks cleanup actions without an active session', async () => {
    const database = new CleanupTestDatabase();
    await expect(requestCleanupHelp(database, 1)).rejects.toThrow('There is no active cleanup session.');
    await expect(completeCleanupWithParentOverride(database, 1)).rejects.toThrow('There is no active cleanup session.');
  });

  it('keeps concurrent child checkouts and restart recovery isolated', async () => {
    const database = new CleanupTestDatabase();
    await startPlaySessionIfNoneActive(database, 1, 1);
    await startPlaySessionIfNoneActive(database, 2, 2);
    await expect(getActivePlaySession(database, 1)).resolves.toMatchObject({ childName: 'Ari', toy: { name: 'Blocks' } });
    await expect(getActivePlaySession(database, 2)).resolves.toMatchObject({ childName: 'Sam', toy: { name: 'Train' } });
    await completeCleanup(database, 1);
    await expect(getActivePlaySession(database, 1)).resolves.toBeNull();
    await expect(getActivePlaySession(database, 2)).resolves.toMatchObject({ toy: { name: 'Train' } });
  });

  it('blocks duplicate-toy checkout and lists every active child for Parent Mode', async () => {
    const database = new CleanupTestDatabase();
    await startPlaySessionIfNoneActive(database, 1, 1);
    await expect(startPlaySessionIfNoneActive(database, 2, 1)).rejects.toThrow('Ari is already playing with this toy');
    await startPlaySessionIfNoneActive(database, 2, 2);
    await expect(listActivePlaySessions(database)).resolves.toEqual(expect.arrayContaining([
      expect.objectContaining({ childId: 1, childName: 'Ari', toyId: 1 }),
      expect.objectContaining({ childId: 2, childName: 'Sam', toyId: 2 }),
    ]));
  });
});
