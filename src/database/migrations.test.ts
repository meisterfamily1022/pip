import { LATEST_DATABASE_VERSION, runMigrations } from './migrations';
import type { DatabaseConnection, SqlParameters, SqlRunResult } from './types';

const v1ToyColumns = [
  'id', 'name', 'image_uri', 'room_id', 'storage_spot_id', 'cleanup_difficulty',
  'adult_help_required', 'is_available', 'is_archived', 'created_at', 'updated_at',
];
const legacyToyColumns = [
  'id', 'name', 'image_uri', 'room_id', 'storage_spot_id',
  'is_available', 'is_archived', 'created_at', 'updated_at',
];
const v1SessionColumns = [
  'id', 'toy_id', 'status', 'started_at', 'completed_at', 'cleanup_started_at',
  'help_requested', 'parent_override_used', 'created_at', 'updated_at',
];

class SchemaDatabase implements DatabaseConnection {
  public version: number;
  public childNickname: string | null = null;
  public onboardingCompleted = 0;
  public readonly tables = new Map<string, string[]>();
  public readonly executedSources: string[] = [];
  public readonly toyRecords = [{ id: 7, name: 'Wooden Train', image_uri: 'file:///train.jpg', original_image_uri: null as string | null, cleanup_difficulty: 'medium' }];

  constructor(version = 0, toyColumns: string[] = [], sessionColumns: string[] = []) {
    this.version = version;
    if (toyColumns.length > 0) this.tables.set('toys', [...toyColumns]);
    if (sessionColumns.length > 0) this.tables.set('play_sessions', [...sessionColumns]);
    if (version > 0) this.tables.set('settings', ['id', 'onboarding_completed', 'child_nickname', 'choice_limit', 'cleanup_required', 'created_at', 'updated_at']);
  }

  async execAsync(source: string): Promise<void> {
    this.executedSources.push(source);
    if (source.includes('length(trim(child_nickname)) < 2') && this.childNickname !== null && this.childNickname.trim().length < 2) {
      this.childNickname = null;
      this.onboardingCompleted = 0;
    }
    if (source.includes('CREATE TABLE IF NOT EXISTS toys') && !this.tables.has('toys')) {
      this.tables.set('toys', [...v1ToyColumns]);
    }
    if (source.includes('CREATE TABLE IF NOT EXISTS play_sessions') && !this.tables.has('play_sessions')) {
      this.tables.set('play_sessions', [...v1SessionColumns]);
    }
    if (source.includes('CREATE TABLE IF NOT EXISTS settings') && !this.tables.has('settings')) this.tables.set('settings', ['id', 'onboarding_completed', 'child_nickname', 'choice_limit', 'cleanup_required', 'created_at', 'updated_at']);
    if (source.includes('CREATE TABLE IF NOT EXISTS child_profiles') && !this.tables.has('child_profiles')) this.tables.set('child_profiles', ['id', 'name', 'created_at', 'updated_at']);
    if (source.includes('CREATE TABLE IF NOT EXISTS toy_setup_drafts')) this.tables.set('toy_setup_drafts', ['id']);

    const alter = source.match(/ALTER TABLE "([^"]+)" ADD COLUMN "([^"]+)"/);
    if (alter?.[1] && alter[2]) {
      const columns = this.tables.get(alter[1]);
      if (!columns) throw new Error(`Missing table: ${alter[1]}`);
      if (columns.includes(alter[2])) throw new Error(`duplicate column name: ${alter[2]}`);
      columns.push(alter[2]);
      if (alter[1] === 'toys' && alter[2] === 'cleanup_difficulty') {
        for (const record of this.toyRecords) record.cleanup_difficulty = record.cleanup_difficulty ?? 'easy';
      }
    }

    const version = source.match(/PRAGMA user_version = (\d+);/);
    if (version?.[1]) this.version = Number(version[1]);
  }

  async runAsync(source: string, ..._parameters: SqlParameters): Promise<SqlRunResult> {
    if (source.startsWith('UPDATE toys SET original_image_uri')) {
      for (const record of this.toyRecords) if (record.original_image_uri === null) record.original_image_uri = record.image_uri;
    }
    return { lastInsertRowId: 0, changes: 0 };
  }

  async getFirstAsync<T>(source: string, ..._parameters: SqlParameters): Promise<T | null> {
    if (source.startsWith('PRAGMA user_version')) return { user_version: this.version } as T;
    return null;
  }

  async getAllAsync<T>(source: string, ..._parameters: SqlParameters): Promise<T[]> {
    const table = source.match(/PRAGMA table_info\("([^"]+)"\)/)?.[1];
    if (!table) return [];
    return (this.tables.get(table) ?? []).map((name) => ({ name }) as T);
  }

  async withTransactionAsync(task: () => Promise<void>): Promise<void> {
    await task();
  }
}

function cleanupDifficultyCount(database: SchemaDatabase): number {
  return (database.tables.get('toys') ?? []).filter((column) => column === 'cleanup_difficulty').length;
}

describe('SQLite migration compatibility', () => {
  it('initializes a fresh database with exactly one cleanup_difficulty column', async () => {
    const database = new SchemaDatabase();
    await runMigrations(database);
    expect(database.version).toBe(LATEST_DATABASE_VERSION);
    expect(cleanupDifficultyCount(database)).toBe(1);
  });

  it('safely applies migration 2 after the checked-in migration 1 schema', async () => {
    const database = new SchemaDatabase(1, v1ToyColumns, v1SessionColumns);
    await expect(runMigrations(database)).resolves.toBeUndefined();
    expect(cleanupDifficultyCount(database)).toBe(1);
  });

  it('is safe to rerun after all migrations have completed', async () => {
    const database = new SchemaDatabase();
    await runMigrations(database);
    const columnsAfterFirstRun = [...(database.tables.get('toys') ?? [])];
    await runMigrations(database);
    expect(database.tables.get('toys')).toEqual(columnsAfterFirstRun);
    expect(cleanupDifficultyCount(database)).toBe(1);
  });

  it('returns a leaked one-character review nickname to clean onboarding', async () => {
    const database = new SchemaDatabase(6, v1ToyColumns, v1SessionColumns);
    database.childNickname = 'b';
    database.onboardingCompleted = 1;
    await runMigrations(database);
    expect(database.childNickname).toBeNull();
    expect(database.onboardingCompleted).toBe(0);
  });

  it('preserves an existing cleanup_difficulty column and toy records', async () => {
    const database = new SchemaDatabase(2, v1ToyColumns, v1SessionColumns);
    await runMigrations(database);
    expect(cleanupDifficultyCount(database)).toBe(1);
    expect(database.toyRecords).toEqual([{ id: 7, name: 'Wooden Train', image_uri: 'file:///train.jpg', original_image_uri: 'file:///train.jpg', cleanup_difficulty: 'medium' }]);
  });

  it('copies the legacy image into original_image_uri and keeps existing toys manual', async () => {
    const database = new SchemaDatabase();
    await runMigrations(database);
    expect(database.toyRecords[0]).toMatchObject({ image_uri: 'file:///train.jpg', original_image_uri: 'file:///train.jpg' });
    expect(database.tables.get('toys')).toEqual(expect.arrayContaining(['original_image_uri', 'enhanced_image_uri', 'preferred_image_variant', 'ai_metadata_status', 'ai_analysis_id', 'ai_schema_version', 'ai_consent_at', 'ai_confirmed_at']));
  });

  it('adds persistent intake and duplicate-protection columns', async () => {
    const database = new SchemaDatabase();
    await runMigrations(database);
    expect(database.tables.get('toys')).toContain('intake_key');
    expect(database.tables.get('toy_setup_drafts')).toEqual(expect.arrayContaining(['is_available_draft', 'saved_toy_id', 'save_error']));
  });

  it('repairs a versioned database where cleanup_difficulty is missing', async () => {
    const database = new SchemaDatabase(2, legacyToyColumns, v1SessionColumns);
    database.toyRecords[0]!.cleanup_difficulty = undefined as unknown as string;
    await runMigrations(database);
    expect(cleanupDifficultyCount(database)).toBe(1);
    expect(database.toyRecords[0]).toMatchObject({ id: 7, name: 'Wooden Train', cleanup_difficulty: 'easy', original_image_uri: 'file:///train.jpg' });
  });

  it('adds child ownership and replaces the global active-session constraint without resetting legacy data', async () => {
    const database = new SchemaDatabase(7, v1ToyColumns, v1SessionColumns);
    await runMigrations(database);
    expect(database.tables.get('settings')).toContain('active_child_id');
    expect(database.tables.get('play_sessions')).toContain('child_id');
    const migrationSql = database.executedSources.join('\n');
    expect(migrationSql).toContain('UPDATE play_sessions');
    expect(migrationSql).toContain('DROP INDEX IF EXISTS active_play_session');
    expect(migrationSql).toContain('active_play_session_per_child');
    expect(migrationSql).toContain('active_play_session_per_toy');
  });
});
