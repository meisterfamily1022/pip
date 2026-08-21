import { LOCAL_HOUSEHOLD_ID } from '@/database/migrations';
import type { DatabaseConnection } from '@/database/types';

/**
 * Connecting a local library to a household.
 *
 * Pip is local-first, so this is opt-in and reversible in intent: the local
 * database remains the working copy, and connecting only records the link and
 * queues each record for upload.
 *
 * **No remote transport ships yet.** There is no durable server-side store for
 * household data is intentionally not synced yet, so
 * nothing here claims a library is backed up. What is implemented and tested is
 * everything that must be right *before* a transport exists: eligibility,
 * durable per-record state, idempotent retries, tombstones, and a conflict
 * policy that refuses to destroy data silently.
 */

export type ConnectionEligibility =
  | { eligible: true }
  | { eligible: false; reason: EligibilityProblem; message: string };

export type EligibilityProblem =
  | 'no-account'
  | 'email-unverified'
  | 'already-connected'
  | 'connected-elsewhere'
  | 'nothing-to-connect';

export type AccountSnapshot = {
  accountId: string;
  householdId: string;
  emailVerified: boolean;
} | null;

const problems: Record<EligibilityProblem, string> = {
  'no-account': 'Create an account first. Your library stays on this device until you do.',
  'email-unverified': 'Confirm your email address before connecting your library.',
  'already-connected': 'This library is already connected to your account.',
  'connected-elsewhere': 'This library is connected to a different account. Sign in with that account instead.',
  'nothing-to-connect': 'There is nothing to connect yet. Add a toy first.',
};

const problem = (reason: EligibilityProblem): ConnectionEligibility => ({
  eligible: false,
  reason,
  message: problems[reason],
});

/**
 * Whether this device's library can be attached to the signed-in account.
 *
 * Checked before any write, so a parent is told why rather than watching a
 * button do nothing.
 */
export async function checkConnectionEligibility(
  database: DatabaseConnection,
  account: AccountSnapshot,
  householdId: string = LOCAL_HOUSEHOLD_ID,
): Promise<ConnectionEligibility> {
  if (!account) return problem('no-account');
  if (!account.emailVerified) return problem('email-unverified');

  const household = await database.getFirstAsync<{ remote_id: string | null }>(
    'SELECT remote_id FROM households WHERE id = ?;',
    householdId,
  );
  if (!household) return problem('nothing-to-connect');

  if (household.remote_id !== null) {
    // Already linked. Linking to the same household again is a no-op; linking
    // to a different one would silently move a family's library.
    return household.remote_id === account.householdId ? problem('already-connected') : problem('connected-elsewhere');
  }

  const counts = await database.getFirstAsync<{ count: number }>(
    'SELECT COUNT(*) AS count FROM toys WHERE household_id = ? AND is_sample = 0;',
    householdId,
  );
  // Sample toys are not a library worth uploading.
  if ((counts?.count ?? 0) === 0) return problem('nothing-to-connect');

  return { eligible: true };
}

/* ------------------------------------------------------------ import queue */

export type SyncOperationStatus = 'pending' | 'in_flight' | 'done' | 'conflict' | 'failed';

export type SyncOperation = {
  entity: string;
  entityId: string;
  status: SyncOperationStatus;
  conflictReason: string | null;
  attempts: number;
  lastError: string | null;
};

const now = (): string => new Date().toISOString();

/** Entities queued for upload, in the order they must be applied. */
const IMPORT_ORDER = ['room', 'child_profile', 'storage_spot', 'toy', 'play_session'] as const;

const SOURCE_TABLES: Record<(typeof IMPORT_ORDER)[number], string> = {
  room: 'rooms',
  child_profile: 'child_profiles',
  storage_spot: 'storage_spots',
  toy: 'toys',
  // Play history is part of a family's library, not incidental: "Ari played
  // with this two days ago" is what the home screen is built around. Leaving
  // sessions out of the queue meant a restore brought back the toys and none
  // of the story attached to them.
  play_session: 'play_sessions',
};

/**
 * Queues every local record for upload.
 *
 * Idempotent by primary key `(entity, entity_id, household_id)`: running it
 * again after an interruption re-queues nothing that already succeeded, so a
 * retry resumes instead of duplicating. Sample rows are excluded — they are
 * demonstration data and must never reach a real household.
 */
export async function planLibraryImport(
  database: DatabaseConnection,
  householdId: string = LOCAL_HOUSEHOLD_ID,
): Promise<number> {
  const timestamp = now();
  let queued = 0;

  await database.withTransactionAsync(async () => {
    for (const entity of IMPORT_ORDER) {
      const table = SOURCE_TABLES[entity];
      // child_profiles carries no sample flag; only inventory tables do.
      const sampleClause = entity === 'child_profile' || entity === 'play_session' ? '' : 'AND is_sample = 0';
      const rows = await database.getAllAsync<{ id: number }>(
        `SELECT id FROM "${table}" WHERE household_id = ? ${sampleClause};`,
        householdId,
      );

      for (const row of rows) {
        const result = await database.runAsync(
          `INSERT INTO sync_operations (entity, entity_id, household_id, status, attempts, created_at, updated_at)
           VALUES (?, ?, ?, 'pending', 0, ?, ?)
           ON CONFLICT (entity, entity_id, household_id) DO NOTHING;`,
          entity,
          String(row.id),
          householdId,
          timestamp,
          timestamp,
        );
        queued += result.changes;
      }
    }
  });

  return queued;
}

export async function listSyncOperations(
  database: DatabaseConnection,
  householdId: string = LOCAL_HOUSEHOLD_ID,
): Promise<SyncOperation[]> {
  const rows = await database.getAllAsync<{
    entity: string;
    entity_id: string;
    status: SyncOperationStatus;
    conflict_reason: string | null;
    attempts: number;
    last_error: string | null;
  }>(
    'SELECT entity, entity_id, status, conflict_reason, attempts, last_error FROM sync_operations WHERE household_id = ? ORDER BY entity, CAST(entity_id AS INTEGER);',
    householdId,
  );
  return rows.map((row) => ({
    entity: row.entity,
    entityId: row.entity_id,
    status: row.status,
    conflictReason: row.conflict_reason,
    attempts: row.attempts,
    lastError: row.last_error,
  }));
}

export type ImportProgress = {
  total: number;
  done: number;
  pending: number;
  conflicts: number;
  failed: number;
};

/** What the parent sees: counts, not internals. */
export async function getImportProgress(
  database: DatabaseConnection,
  householdId: string = LOCAL_HOUSEHOLD_ID,
): Promise<ImportProgress> {
  const rows = await database.getAllAsync<{ status: SyncOperationStatus; count: number }>(
    'SELECT status, COUNT(*) AS count FROM sync_operations WHERE household_id = ? GROUP BY status;',
    householdId,
  );
  const by = (status: SyncOperationStatus): number => rows.find((row) => row.status === status)?.count ?? 0;
  return {
    total: rows.reduce((sum, row) => sum + row.count, 0),
    done: by('done'),
    // An interrupted upload leaves rows in_flight; they are still outstanding.
    pending: by('pending') + by('in_flight'),
    conflicts: by('conflict'),
    failed: by('failed'),
  };
}

export async function markOperation(
  database: DatabaseConnection,
  entity: string,
  entityId: string,
  update: { status: SyncOperationStatus; conflictReason?: string | null; lastError?: string | null },
  householdId: string = LOCAL_HOUSEHOLD_ID,
): Promise<void> {
  await database.runAsync(
    `UPDATE sync_operations
        SET status = ?, conflict_reason = ?, last_error = ?,
            attempts = attempts + CASE WHEN ? = 'failed' THEN 1 ELSE 0 END,
            updated_at = ?
      WHERE entity = ? AND entity_id = ? AND household_id = ?;`,
    update.status,
    update.conflictReason ?? null,
    update.lastError ?? null,
    update.status,
    now(),
    entity,
    entityId,
    householdId,
  );
}

/**
 * Returns interrupted work to the queue.
 *
 * A device that loses power mid-upload leaves rows `in_flight` forever
 * otherwise. Records already `done` are untouched, so resuming never re-uploads
 * them.
 */
export async function requeueInterrupted(
  database: DatabaseConnection,
  householdId: string = LOCAL_HOUSEHOLD_ID,
): Promise<number> {
  const result = await database.runAsync(
    "UPDATE sync_operations SET status = 'pending', updated_at = ? WHERE household_id = ? AND status = 'in_flight';",
    now(),
    householdId,
  );
  return result.changes;
}

/* ---------------------------------------------------------------- tombstones */

/**
 * Records a deletion so it can be replicated.
 *
 * Without this a device that never saw the delete would treat the record as new
 * and resurrect it on the next exchange.
 */
export async function recordDeletion(
  database: DatabaseConnection,
  entity: string,
  entityId: string,
  householdId: string = LOCAL_HOUSEHOLD_ID,
): Promise<void> {
  await database.runAsync(
    `INSERT INTO deleted_records (entity, entity_id, household_id, deleted_at)
     VALUES (?, ?, ?, ?)
     ON CONFLICT (entity, entity_id) DO NOTHING;`,
    entity,
    entityId,
    householdId,
    now(),
  );
}

export async function listTombstones(
  database: DatabaseConnection,
  householdId: string = LOCAL_HOUSEHOLD_ID,
): Promise<{ entity: string; entityId: string }[]> {
  const rows = await database.getAllAsync<{ entity: string; entity_id: string }>(
    'SELECT entity, entity_id FROM deleted_records WHERE household_id = ? ORDER BY entity, entity_id;',
    householdId,
  );
  return rows.map((row) => ({ entity: row.entity, entityId: row.entity_id }));
}

/** True when a record was deleted here, so an incoming copy must not revive it. */
export async function isDeletedLocally(
  database: DatabaseConnection,
  entity: string,
  entityId: string,
): Promise<boolean> {
  const row = await database.getFirstAsync<{ entity_id: string }>(
    'SELECT entity_id FROM deleted_records WHERE entity = ? AND entity_id = ?;',
    entity,
    entityId,
  );
  return row !== null;
}
