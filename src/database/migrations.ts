import type { DatabaseConnection } from './types';

type Migration = {
  version: number;
  source?: string;
  apply?: (database: DatabaseConnection) => Promise<void>;
};

type TableInfoRow = {
  name: string;
};

async function hasColumn(database: DatabaseConnection, table: string, column: string): Promise<boolean> {
  const columns = await database.getAllAsync<TableInfoRow>(`PRAGMA table_info("${table}");`);
  return columns.some((candidate) => candidate.name === column);
}

async function addColumnIfMissing(database: DatabaseConnection, table: string, column: string, definition: string): Promise<void> {
  if (await hasColumn(database, table, column)) return;
  await database.execAsync(`ALTER TABLE "${table}" ADD COLUMN "${column}" ${definition};`);
}

async function ensureToyCleanupColumns(database: DatabaseConnection): Promise<void> {
  await addColumnIfMissing(database, 'toys', 'cleanup_difficulty', "TEXT NOT NULL DEFAULT 'easy' CHECK (cleanup_difficulty IN ('easy', 'medium', 'big'))");
  await addColumnIfMissing(database, 'toys', 'adult_help_required', 'INTEGER NOT NULL DEFAULT 0 CHECK (adult_help_required IN (0, 1))');
}

async function ensurePlaySessionCleanupColumns(database: DatabaseConnection): Promise<void> {
  await addColumnIfMissing(database, 'play_sessions', 'cleanup_started_at', 'TEXT');
  await addColumnIfMissing(database, 'play_sessions', 'help_requested', 'INTEGER NOT NULL DEFAULT 0 CHECK (help_requested IN (0, 1))');
  await addColumnIfMissing(database, 'play_sessions', 'parent_override_used', 'INTEGER NOT NULL DEFAULT 0 CHECK (parent_override_used IN (0, 1))');
}

async function ensureAiToySetupColumns(database: DatabaseConnection): Promise<void> {
  await addColumnIfMissing(database, 'toys', 'original_image_uri', 'TEXT');
  await addColumnIfMissing(database, 'toys', 'enhanced_image_uri', 'TEXT');
  await addColumnIfMissing(database, 'toys', 'preferred_image_variant', "TEXT NOT NULL DEFAULT 'original' CHECK (preferred_image_variant IN ('original', 'enhanced'))");
  await addColumnIfMissing(database, 'toys', 'ai_metadata_status', "TEXT NOT NULL DEFAULT 'manual' CHECK (ai_metadata_status IN ('manual', 'suggested', 'confirmed'))");
  await addColumnIfMissing(database, 'toys', 'ai_analysis_id', 'TEXT');
  await addColumnIfMissing(database, 'toys', 'ai_schema_version', 'TEXT');
  await addColumnIfMissing(database, 'toys', 'ai_consent_at', 'TEXT');
  await addColumnIfMissing(database, 'toys', 'ai_confirmed_at', 'TEXT');
  await database.runAsync('UPDATE toys SET original_image_uri = image_uri WHERE original_image_uri IS NULL AND image_uri IS NOT NULL;');
  await database.runAsync("UPDATE toys SET preferred_image_variant = 'original' WHERE preferred_image_variant IS NULL;");
  await database.runAsync("UPDATE toys SET ai_metadata_status = 'manual' WHERE ai_metadata_status IS NULL;");
}

async function ensureToySetupDraftsTable(database: DatabaseConnection): Promise<void> {
  await database.execAsync(`
    CREATE TABLE IF NOT EXISTS toy_setup_drafts (
      id TEXT PRIMARY KEY NOT NULL,
      original_image_uri TEXT NOT NULL CHECK (length(trim(original_image_uri)) > 0),
      enhanced_image_uri TEXT,
      draft_name TEXT,
      room_id INTEGER REFERENCES rooms(id) ON DELETE SET NULL,
      storage_spot_id INTEGER REFERENCES storage_spots(id) ON DELETE SET NULL,
      categories_json TEXT NOT NULL DEFAULT '[]',
      cleanup_difficulty_draft TEXT CHECK (cleanup_difficulty_draft IN ('easy', 'medium', 'big')),
      adult_help_required_draft INTEGER CHECK (adult_help_required_draft IN (0, 1)),
      analysis_status TEXT NOT NULL DEFAULT 'not_requested' CHECK (analysis_status IN ('not_requested', 'queued', 'processing', 'ready', 'failed')),
      enhancement_status TEXT NOT NULL DEFAULT 'not_requested' CHECK (enhancement_status IN ('not_requested', 'queued', 'processing', 'ready', 'failed')),
      ai_consent_at TEXT,
      parent_reviewed_at TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      expires_at TEXT
    );
    CREATE INDEX IF NOT EXISTS toy_setup_drafts_expires_at_index ON toy_setup_drafts(expires_at);
  `);
}

async function ensureProductionPhotoIntakeColumns(database: DatabaseConnection): Promise<void> {
  await addColumnIfMissing(database, 'toys', 'intake_key', 'TEXT');
  await database.execAsync('CREATE UNIQUE INDEX IF NOT EXISTS toys_intake_key_unique ON toys(intake_key) WHERE intake_key IS NOT NULL;');
  await addColumnIfMissing(database, 'toy_setup_drafts', 'is_available_draft', 'INTEGER NOT NULL DEFAULT 1 CHECK (is_available_draft IN (0, 1))');
  await addColumnIfMissing(database, 'toy_setup_drafts', 'saved_toy_id', 'INTEGER REFERENCES toys(id) ON DELETE SET NULL');
  await addColumnIfMissing(database, 'toy_setup_drafts', 'save_error', 'TEXT');
}

async function ensureMultiChildSessions(database: DatabaseConnection): Promise<void> {
  await database.execAsync(`
    CREATE TABLE IF NOT EXISTS child_profiles (
      id INTEGER PRIMARY KEY NOT NULL,
      name TEXT NOT NULL COLLATE NOCASE CHECK (length(trim(name)) >= 2),
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
  `);
  await addColumnIfMissing(database, 'settings', 'active_child_id', 'INTEGER REFERENCES child_profiles(id) ON DELETE SET NULL');
  await addColumnIfMissing(database, 'play_sessions', 'child_id', 'INTEGER REFERENCES child_profiles(id) ON DELETE RESTRICT');
  await database.execAsync(`
    INSERT INTO child_profiles (name, created_at, updated_at)
    SELECT trim(child_nickname), created_at, updated_at
      FROM settings
     WHERE child_nickname IS NOT NULL
       AND length(trim(child_nickname)) >= 2
       AND NOT EXISTS (SELECT 1 FROM child_profiles);

    INSERT INTO child_profiles (name, created_at, updated_at)
    SELECT 'Child', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
     WHERE EXISTS (SELECT 1 FROM play_sessions)
       AND NOT EXISTS (SELECT 1 FROM child_profiles);

    UPDATE settings
       SET active_child_id = COALESCE(active_child_id, (SELECT id FROM child_profiles ORDER BY id LIMIT 1))
     WHERE id = 1;

    UPDATE play_sessions
       SET child_id = COALESCE(child_id, (SELECT id FROM child_profiles ORDER BY id LIMIT 1));

    DROP INDEX IF EXISTS active_play_session;
    CREATE UNIQUE INDEX IF NOT EXISTS active_play_session_per_child
      ON play_sessions(child_id) WHERE status = 'active';
    CREATE UNIQUE INDEX IF NOT EXISTS active_play_session_per_toy
      ON play_sessions(toy_id) WHERE status = 'active';
    CREATE INDEX IF NOT EXISTS play_sessions_child_id_index ON play_sessions(child_id);
  `);
}

const migrations: readonly Migration[] = [
  {
    version: 1,
    source: `
      CREATE TABLE IF NOT EXISTS rooms (
        id INTEGER PRIMARY KEY NOT NULL,
        name TEXT NOT NULL COLLATE NOCASE UNIQUE CHECK (length(trim(name)) > 0),
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS storage_spots (
        id INTEGER PRIMARY KEY NOT NULL,
        room_id INTEGER NOT NULL REFERENCES rooms(id) ON DELETE RESTRICT,
        name TEXT NOT NULL COLLATE NOCASE CHECK (length(trim(name)) > 0),
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        UNIQUE(room_id, name)
      );

      CREATE TABLE IF NOT EXISTS toys (
        id INTEGER PRIMARY KEY NOT NULL,
        name TEXT NOT NULL CHECK (length(trim(name)) > 0),
        image_uri TEXT,
        room_id INTEGER NOT NULL REFERENCES rooms(id) ON DELETE RESTRICT,
        storage_spot_id INTEGER NOT NULL REFERENCES storage_spots(id) ON DELETE RESTRICT,
        cleanup_difficulty TEXT NOT NULL DEFAULT 'easy' CHECK (cleanup_difficulty IN ('easy', 'medium', 'big')),
        adult_help_required INTEGER NOT NULL DEFAULT 0 CHECK (adult_help_required IN (0, 1)),
        is_available INTEGER NOT NULL DEFAULT 1 CHECK (is_available IN (0, 1)),
        is_archived INTEGER NOT NULL DEFAULT 0 CHECK (is_archived IN (0, 1)),
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        CHECK (length(image_uri) > 0 OR image_uri IS NULL)
      );

      CREATE TABLE IF NOT EXISTS toy_categories (
        toy_id INTEGER NOT NULL REFERENCES toys(id) ON DELETE CASCADE,
        category TEXT NOT NULL CHECK (category IN ('quiet', 'active', 'creative', 'building', 'pretend', 'sensory', 'independent', 'together', 'indoor', 'outdoor')),
        created_at TEXT NOT NULL,
        PRIMARY KEY (toy_id, category)
      );

      CREATE TABLE IF NOT EXISTS play_sessions (
        id INTEGER PRIMARY KEY NOT NULL,
        toy_id INTEGER NOT NULL REFERENCES toys(id) ON DELETE RESTRICT,
        status TEXT NOT NULL CHECK (status IN ('active', 'completed')),
        started_at TEXT NOT NULL,
        completed_at TEXT,
        cleanup_started_at TEXT,
        help_requested INTEGER NOT NULL DEFAULT 0 CHECK (help_requested IN (0, 1)),
        parent_override_used INTEGER NOT NULL DEFAULT 0 CHECK (parent_override_used IN (0, 1)),
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        CHECK ((status = 'active' AND completed_at IS NULL) OR (status = 'completed' AND completed_at IS NOT NULL))
      );

      CREATE UNIQUE INDEX IF NOT EXISTS active_play_session ON play_sessions(status) WHERE status = 'active';
      CREATE INDEX IF NOT EXISTS storage_spots_room_id_index ON storage_spots(room_id);
      CREATE INDEX IF NOT EXISTS toys_room_id_index ON toys(room_id);
      CREATE INDEX IF NOT EXISTS toys_storage_spot_id_index ON toys(storage_spot_id);
      CREATE INDEX IF NOT EXISTS toys_name_index ON toys(name);
      CREATE INDEX IF NOT EXISTS toy_categories_category_index ON toy_categories(category);
      CREATE INDEX IF NOT EXISTS play_sessions_toy_id_index ON play_sessions(toy_id);

      CREATE TABLE IF NOT EXISTS settings (
        id INTEGER PRIMARY KEY NOT NULL CHECK (id = 1),
        onboarding_completed INTEGER NOT NULL DEFAULT 0 CHECK (onboarding_completed IN (0, 1)),
        parent_pin TEXT,
        child_nickname TEXT,
        choice_limit INTEGER NOT NULL DEFAULT 3 CHECK (choice_limit IN (1, 3, 5)),
        cleanup_required INTEGER NOT NULL DEFAULT 1 CHECK (cleanup_required IN (0, 1)),
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
    `,
  },
  {
    version: 2,
    apply: ensureToyCleanupColumns,
  },
  {
    version: 3,
    apply: ensurePlaySessionCleanupColumns,
  },
  {
    version: 4,
    apply: async (database) => {
      await ensureToyCleanupColumns(database);
      await ensurePlaySessionCleanupColumns(database);
    },
  },
  {
    version: 5,
    apply: async (database) => {
      await ensureAiToySetupColumns(database);
      await ensureToySetupDraftsTable(database);
    },
  },
  {
    version: 6,
    apply: async (database) => {
      await ensureAiToySetupColumns(database);
      await ensureToySetupDraftsTable(database);
      await ensureProductionPhotoIntakeColumns(database);
    },
  },
  {
    version: 7,
    apply: async (database) => {
      // One-character values came from pre-launch review sessions. Returning the
      // profile to onboarding is safer than showing test data or inventing a name.
      await database.execAsync(`
        UPDATE settings
           SET onboarding_completed = 0,
               child_nickname = NULL,
               updated_at = CURRENT_TIMESTAMP
         WHERE child_nickname IS NOT NULL
           AND length(trim(child_nickname)) < 2;
      `);
    },
  },
  {
    version: 8,
    apply: ensureMultiChildSessions,
  },
];

export async function runMigrations(database: DatabaseConnection): Promise<void> {
  await database.execAsync('PRAGMA foreign_keys = ON;');
  await database.execAsync('PRAGMA journal_mode = WAL;');
  const versionRow = await database.getFirstAsync<{ user_version: number }>('PRAGMA user_version;');
  let currentVersion = versionRow?.user_version ?? 0;

  for (const migration of migrations) {
    if (migration.version <= currentVersion) continue;
    await database.withTransactionAsync(async () => {
      if (migration.source) await database.execAsync(migration.source);
      if (migration.apply) await migration.apply(database);
      await database.execAsync(`PRAGMA user_version = ${migration.version};`);
    });
    currentVersion = migration.version;
  }
}

export const LATEST_DATABASE_VERSION = migrations.at(-1)?.version ?? 0;
