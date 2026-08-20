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

/**
 * The household every pre-account record belongs to.
 *
 * A fixed literal rather than a generated id, so re-running the migration
 * re-selects the same row instead of creating a second household.
 */
export const LOCAL_HOUSEHOLD_ID = 'local';

/**
 * Household scope, richer child profiles, per-child toy visibility, and Guest
 * play.
 *
 * Everything here is additive except one index swap: the per-child active
 * session index is replaced by one that also covers Guest. That drops and
 * recreates an *index*, never a row.
 */
async function ensureHouseholdsAndProfileDetail(database: DatabaseConnection): Promise<void> {
  await database.execAsync(`
    CREATE TABLE IF NOT EXISTS households (
      id TEXT PRIMARY KEY NOT NULL,
      name TEXT NOT NULL CHECK (length(trim(name)) > 0),
      -- Cleared once the household is connected to a parent account.
      is_local_only INTEGER NOT NULL DEFAULT 1 CHECK (is_local_only IN (0, 1)),
      -- Server-side id, set when the library is connected. Unique so a retried
      -- connect cannot attach one household to two remote records.
      remote_id TEXT UNIQUE,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    -- Tombstones so a later sync can replicate deletions instead of
    -- resurrecting rows that one device already removed.
    CREATE TABLE IF NOT EXISTS deleted_records (
      entity TEXT NOT NULL,
      entity_id TEXT NOT NULL,
      household_id TEXT,
      deleted_at TEXT NOT NULL,
      PRIMARY KEY (entity, entity_id)
    );

    CREATE TABLE IF NOT EXISTS toy_child_visibility (
      toy_id INTEGER NOT NULL REFERENCES toys(id) ON DELETE CASCADE,
      child_id INTEGER NOT NULL REFERENCES child_profiles(id) ON DELETE CASCADE,
      created_at TEXT NOT NULL,
      PRIMARY KEY (toy_id, child_id)
    );
    CREATE INDEX IF NOT EXISTS toy_child_visibility_child_index ON toy_child_visibility(child_id);
  `);

  // One household for everything that already exists on this device.
  await database.runAsync(
    `INSERT OR IGNORE INTO households (id, name, is_local_only, created_at, updated_at)
     VALUES (?, 'My Pip', 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);`,
    LOCAL_HOUSEHOLD_ID,
  );

  for (const table of ['rooms', 'storage_spots', 'toys', 'child_profiles', 'play_sessions']) {
    await addColumnIfMissing(database, table, 'household_id', 'TEXT REFERENCES households(id) ON DELETE RESTRICT');
    await database.runAsync(`UPDATE "${table}" SET household_id = ? WHERE household_id IS NULL;`, LOCAL_HOUSEHOLD_ID);
    await database.execAsync(`CREATE INDEX IF NOT EXISTS ${table}_household_index ON "${table}"(household_id);`);
  }

  // Per-child presentation and preferences. Each is nullable or defaulted, so
  // existing profiles stay valid without a backfill they cannot supply.
  await addColumnIfMissing(database, 'child_profiles', 'avatar_id', "TEXT NOT NULL DEFAULT 'circle-dot'");
  await addColumnIfMissing(database, 'child_profiles', 'accent_color_id', "TEXT NOT NULL DEFAULT 'mint'");
  await addColumnIfMissing(database, 'child_profiles', 'age_range', 'TEXT');
  await addColumnIfMissing(database, 'child_profiles', 'choice_limit', 'INTEGER NOT NULL DEFAULT 3 CHECK (choice_limit IN (1, 3, 5))');
  await addColumnIfMissing(
    database,
    'child_profiles',
    'reading_support',
    "TEXT NOT NULL DEFAULT 'pictures-words' CHECK (reading_support IN ('pictures', 'pictures-words', 'pictures-words-audio'))",
  );
  await addColumnIfMissing(database, 'child_profiles', 'display_order', 'INTEGER NOT NULL DEFAULT 0');
  await addColumnIfMissing(database, 'child_profiles', 'hidden_at', 'TEXT');

  // The device-wide choice limit becomes each existing child's own setting, so
  // nobody's Child Mode silently changes shape on upgrade.
  await database.execAsync(`
    UPDATE child_profiles
       SET choice_limit = COALESCE((SELECT choice_limit FROM settings WHERE id = 1), 3)
     WHERE choice_limit IS NULL OR choice_limit = 3;

    UPDATE child_profiles SET display_order = id WHERE display_order = 0;
  `);

  // Availability replaces the is_available flag as the source of truth while
  // preserving what it already meant: hidden toys were hidden from the child.
  await addColumnIfMissing(
    database,
    'toys',
    'availability_scope',
    "TEXT NOT NULL DEFAULT 'everyone' CHECK (availability_scope IN ('everyone', 'selected', 'parent_only', 'temporarily_unavailable'))",
  );
  await database.execAsync(`
    UPDATE toys SET availability_scope = 'parent_only' WHERE is_available = 0 AND availability_scope = 'everyone';
  `);

  // Guest play stores child_id NULL. SQLite treats NULLs as distinct in a
  // unique index, so keying on child_id alone would allow unlimited concurrent
  // Guest sessions. COALESCE collapses Guest to one reserved key.
  await database.execAsync(`
    DROP INDEX IF EXISTS active_play_session_per_child;
    CREATE UNIQUE INDEX IF NOT EXISTS active_play_session_per_participant
      ON play_sessions(COALESCE(child_id, -1)) WHERE status = 'active';
  `);
}

/**
 * Marks rows created by "Explore with sample toys".
 *
 * A flag rather than a separate household, so sample toys appear in the real
 * library where a parent can actually try the product, while staying removable
 * in one action and impossible to mistake for their own toys.
 */
async function ensureSampleFlags(database: DatabaseConnection): Promise<void> {
  for (const table of ['rooms', 'storage_spots', 'toys']) {
    await addColumnIfMissing(database, table, 'is_sample', 'INTEGER NOT NULL DEFAULT 0 CHECK (is_sample IN (0, 1))');
  }
  await database.execAsync('CREATE INDEX IF NOT EXISTS toys_is_sample_index ON toys(is_sample);');
}

/**
 * Durable, restart-safe state for connecting a local library to a household.
 *
 * An import can be interrupted by a lost connection, a backgrounded app, or a
 * device restart. Recording each record's outcome means a retry resumes rather
 * than starting again, and cannot import the same row twice.
 */
async function ensureSyncOperations(database: DatabaseConnection): Promise<void> {
  await database.execAsync(`
    CREATE TABLE IF NOT EXISTS sync_operations (
      -- Stable across retries: the same local record always maps to the same row.
      entity TEXT NOT NULL,
      entity_id TEXT NOT NULL,
      household_id TEXT NOT NULL REFERENCES households(id) ON DELETE CASCADE,
      status TEXT NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'in_flight', 'done', 'conflict', 'failed')),
      -- Set when the record needs a decision rather than an automatic answer.
      conflict_reason TEXT,
      attempts INTEGER NOT NULL DEFAULT 0,
      last_error TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      PRIMARY KEY (entity, entity_id, household_id)
    );
    CREATE INDEX IF NOT EXISTS sync_operations_status_index ON sync_operations(status);
  `);
}

async function ensureChildModeProgress(database: DatabaseConnection): Promise<void> {
  await addColumnIfMissing(database, 'settings', 'child_mode_used', 'INTEGER NOT NULL DEFAULT 0 CHECK (child_mode_used IN (0, 1))');
  // Existing play records prove that Child Mode has already been used.
  await database.execAsync(`
    UPDATE settings
       SET child_mode_used = 1
     WHERE id = 1
       AND EXISTS (SELECT 1 FROM play_sessions);
  `);
}

async function ensureCleanupProgress(database: DatabaseConnection): Promise<void> {
  await addColumnIfMissing(database, 'play_sessions', 'cleanup_step', 'INTEGER NOT NULL DEFAULT 0 CHECK (cleanup_step BETWEEN 0 AND 2)');
}

/**
 * Gives a household an owner, so two adults on one device stay separate.
 *
 * Until now every row belonged to the single household `'local'` and nothing
 * filtered on it: signing out and signing in as somebody else left the previous
 * family's library on screen, because no part of the schema knew a library
 * could belong to anyone in particular.
 *
 * `owner_account_id` is deliberately nullable, and NULL is the meaningful case:
 * it marks the device-local household — a family using Pip without an account,
 * which stays the supported default. A household gains an owner only when a
 * parent explicitly backs it up, never as a side effect of signing in.
 *
 * The partial unique index allows many NULLs while preventing one account from
 * ending up with two households on the same device, which is how a restore
 * retried at the wrong moment would otherwise split a family's library in half.
 */
async function ensureHouseholdAccountOwnership(database: DatabaseConnection): Promise<void> {
  await addColumnIfMissing(database, 'households', 'owner_account_id', 'TEXT');
  await database.execAsync(`
    CREATE UNIQUE INDEX IF NOT EXISTS households_owner_account_index
      ON households(owner_account_id) WHERE owner_account_id IS NOT NULL;

    -- Which household this device is showing. One row, by construction: the
    -- active household is a property of the device, not of a session, so it
    -- survives relaunch and does not depend on auth state being readable yet
    -- at startup.
    CREATE TABLE IF NOT EXISTS device_household_state (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      active_household_id TEXT NOT NULL REFERENCES households(id) ON DELETE RESTRICT,
      updated_at TEXT NOT NULL
    );
  `);

  // Everything that exists today predates accounts, so it is device-local and
  // active. Both writes are idempotent: a replayed migration changes nothing.
  await database.runAsync(
    'UPDATE households SET owner_account_id = NULL WHERE id = ? AND remote_id IS NULL;',
    LOCAL_HOUSEHOLD_ID,
  );
  await database.runAsync(
    `INSERT OR IGNORE INTO device_household_state (id, active_household_id, updated_at)
     VALUES (1, ?, CURRENT_TIMESTAMP);`,
    LOCAL_HOUSEHOLD_ID,
  );
}

/**
 * Adopts rows the old inserts left without a household.
 *
 * Migration 9 backfilled `household_id` once, but the INSERT statements were
 * never updated to populate it, so every row created since then carries NULL
 * and belongs to nobody. That was invisible while nothing filtered on the
 * column. It stops being invisible the moment scoping is enforced: 'local' does
 * not match NULL, so an existing family would open the app after upgrading and
 * watch part of their library be gone.
 *
 * This is a separate migration rather than an addition to 14 because 14 may
 * already have run — a device that took it before this fix existed would never
 * see the backfill otherwise. Migrations that have shipped are not edited.
 */
async function ensureHouseholdBackfill(database: DatabaseConnection): Promise<void> {
  for (const table of ['rooms', 'storage_spots', 'toys', 'child_profiles', 'play_sessions']) {
    await database.runAsync(`UPDATE "${table}" SET household_id = ? WHERE household_id IS NULL;`, LOCAL_HOUSEHOLD_ID);
  }
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
  {
    version: 9,
    apply: ensureHouseholdsAndProfileDetail,
  },
  {
    version: 10,
    apply: ensureSampleFlags,
  },
  {
    version: 11,
    apply: ensureSyncOperations,
  },
  {
    version: 12,
    apply: ensureChildModeProgress,
  },
  {
    version: 13,
    apply: ensureCleanupProgress,
  },
  {
    version: 14,
    apply: ensureHouseholdAccountOwnership,
  },
  {
    version: 15,
    apply: ensureHouseholdBackfill,
  },
];

/**
 * Applies every pending migration.
 *
 * `upTo` stops at a given version. Production always leaves it unset; tests use
 * it to build a database as an older release left it, so the upgrade path — not
 * just the final schema — can be exercised.
 */
export type MigrationOutcome = {
  /**
   * The database did not exist before this call.
   *
   * Worth reporting because iOS keychain entries outlive an app's files: the
   * parent PIN and the onboarding-started flag survive deleting Pip, while
   * SQLite does not. A brand-new database alongside a keychain PIN is therefore
   * proof of a reinstall, and the only reliable proof available.
   */
  createdDatabase: boolean;
};

export async function runMigrations(
  database: DatabaseConnection,
  upTo = Number.POSITIVE_INFINITY,
): Promise<MigrationOutcome> {
  await database.execAsync('PRAGMA foreign_keys = ON;');
  await database.execAsync('PRAGMA journal_mode = WAL;');
  const versionRow = await database.getFirstAsync<{ user_version: number }>('PRAGMA user_version;');
  let currentVersion = versionRow?.user_version ?? 0;
  const createdDatabase = currentVersion === 0;

  for (const migration of migrations) {
    if (migration.version <= currentVersion) continue;
    if (migration.version > upTo) break;
    await database.withTransactionAsync(async () => {
      if (migration.source) await database.execAsync(migration.source);
      if (migration.apply) await migration.apply(database);
      await database.execAsync(`PRAGMA user_version = ${migration.version};`);
    });
    currentVersion = migration.version;
  }

  return { createdDatabase };
}

export const LATEST_DATABASE_VERSION = migrations.at(-1)?.version ?? 0;
