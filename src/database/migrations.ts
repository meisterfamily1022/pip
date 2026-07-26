import type { DatabaseConnection } from './types';

type Migration = {
  version: number;
  source: string;
};

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
    source: `
      ALTER TABLE toys ADD COLUMN cleanup_difficulty TEXT NOT NULL DEFAULT 'easy' CHECK (cleanup_difficulty IN ('easy', 'medium', 'big'));
      ALTER TABLE toys ADD COLUMN adult_help_required INTEGER NOT NULL DEFAULT 0 CHECK (adult_help_required IN (0, 1));
    `,
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
      await database.execAsync(migration.source);
      await database.execAsync(`PRAGMA user_version = ${migration.version};`);
    });
    currentVersion = migration.version;
  }
}

export const LATEST_DATABASE_VERSION = migrations.at(-1)?.version ?? 0;
