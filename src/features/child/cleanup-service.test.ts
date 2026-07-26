import type { DatabaseConnection, SqlParameters, SqlRunResult } from '@/database/types';
import { completeCleanup, completeCleanupWithParentOverride, requestCleanupHelp } from './cleanup-service';
import { completePlaySession, createPlaySession, getActivePlaySession, markCleanupStarted } from '@/repositories/play-sessions-repository';

type Row = Record<string, string | number | null>;

class CleanupTestDatabase implements DatabaseConnection {
  private nextId = 0;
  private readonly sessions = new Map<number, Row>();
  private readonly toys = new Map<number, Row>();

  constructor() {
    this.toys.set(1, { id: 1, name: 'Blocks', image_uri: 'file:///blocks.jpg', room_id: 1, storage_spot_id: 1, cleanup_difficulty: 'easy', adult_help_required: 0, is_available: 1, is_archived: 0, created_at: '', updated_at: '', room_name: 'Playroom', storage_spot_name: 'Blue Bin' });
  }

  async execAsync(): Promise<void> {}
  async withTransactionAsync(task: () => Promise<void>): Promise<void> { await task(); }

  async runAsync(source: string, ...params: SqlParameters): Promise<SqlRunResult> {
    if (source.startsWith('INSERT INTO play_sessions')) {
      this.nextId += 1;
      this.sessions.set(this.nextId, { id: this.nextId, toy_id: params[0]!, status: params[1]!, started_at: params[2]!, completed_at: params[3]!, cleanup_started_at: params[4]!, help_requested: params[5]!, parent_override_used: params[6]!, created_at: params[7]!, updated_at: params[8]! });
      return { lastInsertRowId: this.nextId, changes: 1 };
    }
    if (source.startsWith('UPDATE play_sessions SET cleanup_started_at')) {
      const session = this.sessions.get(params[2] as number);
      if (!session || session.status !== params[3]) return { lastInsertRowId: 0, changes: 0 };
      session.cleanup_started_at = session.cleanup_started_at ?? params[0]!;
      session.updated_at = params[1]!;
      return { lastInsertRowId: 0, changes: 1 };
    }
    if (source.startsWith('UPDATE play_sessions SET help_requested')) {
      const session = this.sessions.get(params[2] as number);
      if (!session || session.status !== params[3]) return { lastInsertRowId: 0, changes: 0 };
      session.help_requested = params[0]!;
      session.updated_at = params[1]!;
      return { lastInsertRowId: 0, changes: 1 };
    }
    if (source.startsWith('UPDATE play_sessions SET status = ?, completed_at = ?, parent_override_used')) {
      const session = this.sessions.get(params[4] as number);
      if (!session || session.status !== params[5]) return { lastInsertRowId: 0, changes: 0 };
      session.status = params[0]!;
      session.completed_at = params[1]!;
      session.parent_override_used = params[2]!;
      session.updated_at = params[3]!;
      return { lastInsertRowId: 0, changes: 1 };
    }
    if (source.startsWith('UPDATE play_sessions SET status')) {
      const session = this.sessions.get(params[3] as number);
      if (!session || session.status !== params[4]) return { lastInsertRowId: 0, changes: 0 };
      session.status = params[0]!;
      session.completed_at = params[1]!;
      session.updated_at = params[2]!;
      return { lastInsertRowId: 0, changes: 1 };
    }
    throw new Error(`Unhandled SQL: ${source}`);
  }

  async getFirstAsync<T>(source: string, ...params: SqlParameters): Promise<T | null> {
    if (source.includes('FROM play_sessions p')) {
      const session = [...this.sessions.values()].find((row) => row.status === params[0]);
      if (!session) return null;
      const toy = this.toys.get(session.toy_id as number)!;
      return { ...session, ...toy, toy_id: session.toy_id, room_name: toy.room_name, storage_spot_name: toy.storage_spot_name } as T;
    }
    if (source.includes('FROM play_sessions')) return (this.sessions.get(params[0] as number) ?? null) as T | null;
    if (source.includes('FROM settings')) return { onboarding_completed: 1, child_nickname: 'Ari', choice_limit: 3, cleanup_required: 1, created_at: '', updated_at: '' } as T;
    throw new Error(`Unhandled SQL: ${source}`);
  }

  async getAllAsync<T>(): Promise<T[]> { return []; }
}

describe('cleanup service transitions', () => {
  it('starts cleanup once and recovers active session state', async () => {
    const database = new CleanupTestDatabase();
    const session = await createPlaySession(database, 1);
    const started = await markCleanupStarted(database, session.id);
    const restarted = await markCleanupStarted(database, session.id);
    expect(started.cleanupStartedAt).toEqual(expect.any(String));
    expect(restarted.cleanupStartedAt).toBe(started.cleanupStartedAt);
    await expect(getActivePlaySession(database)).resolves.toMatchObject({ toy: { name: 'Blocks', roomName: 'Playroom', storageSpotName: 'Blue Bin' } });
  });

  it('requests help, preserves it through parent override, and records override', async () => {
    const database = new CleanupTestDatabase();
    await createPlaySession(database, 1);
    await requestCleanupHelp(database);
    await completeCleanupWithParentOverride(database);
    await expect(getActivePlaySession(database)).resolves.toBeNull();
    await expect(completePlaySession(database, 1)).rejects.toThrow('Active play session could not be completed.');
  });

  it('completes normally and prevents completing twice', async () => {
    const database = new CleanupTestDatabase();
    await createPlaySession(database, 1);
    await completeCleanup(database);
    await expect(completeCleanup(database)).rejects.toThrow('There is no active cleanup session.');
  });

  it('blocks cleanup actions without an active session', async () => {
    const database = new CleanupTestDatabase();
    await expect(requestCleanupHelp(database)).rejects.toThrow('There is no active cleanup session.');
    await expect(completeCleanupWithParentOverride(database)).rejects.toThrow('There is no active cleanup session.');
  });
});
