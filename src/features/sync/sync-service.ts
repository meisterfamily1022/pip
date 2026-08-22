import type { DatabaseConnection } from '@/database/types';
import { connectHouseholdToAccount, getHousehold } from '@/repositories/households-repository';

import { resolveConflict, type ConflictReason, type SyncEntity, type WriteIntent } from './conflict-resolution';
import type { RemoteHouseholdGateway, RemoteRow } from './remote-gateway';

/**
 * Pushing one record.
 *
 * The whole protocol lives here: propose with the revision last seen, and if
 * the server reports a conflict, resolve it with the pure decision core and
 * either retry with the server's actual current revision or stop, because the
 * server already holds the correct outcome. Nothing here ever reads a clock.
 */

const MAX_ATTEMPTS = 5;

export type PushResult =
  | { outcome: 'applied'; revision: number }
  | { outcome: 'recovered'; revision: number; reason: ConflictReason; notify: string };

export class SyncContentionError extends Error {}

export async function pushRecord(
  gateway: RemoteHouseholdGateway,
  remoteHouseholdId: string,
  entity: SyncEntity,
  localId: number,
  expectedRevision: number | null,
  intent: WriteIntent,
  data: Record<string, unknown> = {},
  attempt = 1,
): Promise<PushResult> {
  const result = await gateway.writeRecord(remoteHouseholdId, entity, localId, expectedRevision, intent, data);
  if (result.outcome === 'applied') return { outcome: 'applied', revision: result.revision };

  if (attempt >= MAX_ATTEMPTS) {
    throw new SyncContentionError(`${entity} ${localId} could not be synced after ${MAX_ATTEMPTS} attempts.`);
  }

  const resolution = resolveConflict(entity, result.server, intent);

  switch (resolution.kind) {
    case 'applied':
      // resolveConflict only returns this when the server side is null, which
      // cannot happen here — writeRecord just reported a conflict, meaning a
      // server record exists. Treated as a defect rather than swallowed.
      throw new Error('Unreachable: a reported conflict implies a server record.');

    case 'converged':
      // Both sides already agree (e.g. both deleted). Nothing left to write.
      return { outcome: 'applied', revision: result.server.revision };

    case 'applied-over-conflict':
      // An ordinary edit lost the race. Try again now that the current
      // revision is known — this *is* "last write wins" once no client clock
      // is allowed to decide it.
      return pushRecord(gateway, remoteHouseholdId, entity, localId, result.server.revision, intent, data, attempt + 1);

    case 'resolved-with-archive': {
      // Two different homes, as the schema intends. conflict_archive holds the
      // *content* that lost — and its CHECK constraint accepts only the two
      // reasons that produce content. A replaced photograph is a path, kept in
      // toy_image_history so the file stays referenced in the bucket rather
      // than orphaned. Sending it to conflict_archive violated that CHECK and
      // failed the whole record, which is how a toy whose photo had been
      // replaced on two devices became unbackupable.
      if (resolution.reason === 'photo-replaced') {
        const losing = resolution.archive.kind === 'edit' ? resolution.archive.photoPath ?? null : null;
        if (losing) await gateway.archiveImagePath(remoteHouseholdId, localId, losing);
      } else {
        await gateway.archiveConflict(remoteHouseholdId, entity, localId, resolution.reason, resolution.archive);
      }
      if (resolution.winner === 'server') {
        // The server's existing row is what stands; there is nothing further
        // to write, only to report.
        return { outcome: 'recovered', revision: result.server.revision, reason: resolution.reason, notify: resolution.notify };
      }
      const retried = await pushRecord(gateway, remoteHouseholdId, entity, localId, result.server.revision, intent, data, attempt + 1);
      return { outcome: 'recovered', revision: retried.revision, reason: resolution.reason, notify: resolution.notify };
    }
  }
}

/** Pulls everything the household has not seen yet, oldest first. */
export async function pullChanges(
  gateway: RemoteHouseholdGateway,
  remoteHouseholdId: string,
  sinceRevision: number,
): Promise<{ rows: RemoteRow[]; latestRevision: number }> {
  const rows = await gateway.fetchChangesSince(remoteHouseholdId, sinceRevision);
  const latestRevision = rows.reduce((max, row) => Math.max(max, row.revision), sinceRevision);
  return { rows, latestRevision };
}

/* ------------------------------------------------------------------------ */
/* Restore                                                                    */
/* ------------------------------------------------------------------------ */

const now = (): string => new Date().toISOString();

export type RestoreEligibility =
  /** Nothing on the device; restore can simply proceed. */
  | { eligible: true; replacesSetup: false }
  /**
   * Only what setup itself just created: a room, a spot and a child profile,
   * and no toys and no play. Restoring replaces those, with the parent's
   * explicit say-so.
   */
  | { eligible: true; replacesSetup: true; message: string }
  | { eligible: false; reason: 'not-empty'; message: string }
  | { eligible: false; reason: 'device-shared'; message: string };

/**
 * Whether ANY household other than this one already has rows in the tables a
 * restore writes to.
 *
 * `applyOneRow` inserts using the remote device's own local integer id —
 * `rooms`/`storage_spots`/`toys`/`child_profiles`/`play_sessions` have no
 * composite key, so that id is only guaranteed unique within the household
 * that originally assigned it. Two households legitimately sharing one
 * device (a second adult signs in, or signs out and back in as someone
 * else) is the ordinary, designed-for case — `household-scope.ts` hands the
 * next person an unowned household rather than the first person's, on
 * purpose. If that second household then restores, its own row ids can
 * collide with the first household's ids already resident in the same
 * tables: one insert quietly fails and is skipped, or — the sharper failure —
 * a row from the *new* household succeeds and ends up foreign-keyed to a
 * room or spot that belongs to the *other* household, because its own row
 * lost the id race. A row with a NULL household — a toy from before
 * migration 9 ever populated the column — is included for the same reason:
 * it is exactly the kind of unscoped row that can occupy an id nothing here
 * expects to be taken.
 */
async function hasOtherHouseholdInventory(database: DatabaseConnection, householdId: string): Promise<boolean> {
  const row = await database.getFirstAsync<{ id: number }>(
    `SELECT id FROM rooms WHERE household_id IS NULL OR household_id != ?
     UNION ALL SELECT id FROM storage_spots WHERE household_id IS NULL OR household_id != ?
     UNION ALL SELECT id FROM toys WHERE household_id IS NULL OR household_id != ?
     UNION ALL SELECT id FROM child_profiles WHERE household_id IS NULL OR household_id != ?
     UNION ALL SELECT id FROM play_sessions WHERE household_id IS NULL OR household_id != ?
     LIMIT 1;`,
    householdId,
    householdId,
    householdId,
    householdId,
    householdId,
  );
  return row !== null;
}

/**
 * Whether this household may receive a restore.
 *
 * Local integer ids are only unique within the device that assigned them —
 * restoring a second household's rows onto a device that already holds
 * unrelated local content would need every id remapped, and nothing here does
 * that yet. So a device with a real library is refused rather than merged
 * unsafely. That applies whether the "real library" is this household's own
 * (checked below) or a *different* household's already resident on this
 * device (`hasOtherHouseholdInventory`) — either way, the physical id space
 * a restore writes into is not empty, and nothing here remaps it.
 *
 * "Real library", though, is not the same as "not empty", and treating them as
 * the same made restore unreachable in the shipped app. Setup requires a room,
 * a storage spot and a child before Account & data can be opened at all, so by
 * the time a parent can ask to restore, the device is never empty and the
 * answer was always no — on the one device that most needs it, a new iPhone.
 *
 * What the guard is really protecting is a family's own work. A room and a
 * child typed thirty seconds ago on a phone with no toys and no play history is
 * not that, so it is offered as a replacement the parent confirms, and anything
 * with a single toy or a single play session in it is still refused outright.
 */
export async function checkRestoreEligibility(
  database: DatabaseConnection,
  householdId: string,
): Promise<RestoreEligibility> {
  if (await hasOtherHouseholdInventory(database, householdId)) {
    return {
      eligible: false,
      reason: 'device-shared',
      message: 'This device already has another family\'s Pip library on it. Restore onto a device with just one library — set this one up fresh instead, or use a device that has not been used for Pip yet.',
    };
  }

  const invested = await database.getFirstAsync<{ id: number }>(
    'SELECT id FROM toys WHERE household_id = ? UNION ALL SELECT id FROM play_sessions WHERE household_id = ? LIMIT 1;',
    householdId,
    householdId,
  );
  if (invested) {
    return {
      eligible: false,
      reason: 'not-empty',
      message: 'This device already has toys of its own. Restore is only available onto a device that has not been used yet.',
    };
  }

  const fromSetup = await database.getFirstAsync<{ id: number }>(
    'SELECT id FROM rooms WHERE household_id = ? UNION ALL SELECT id FROM child_profiles WHERE household_id = ? LIMIT 1;',
    householdId,
    householdId,
  );
  if (fromSetup) {
    return {
      eligible: true,
      replacesSetup: true,
      message: 'The room and child you just set up will be replaced by the ones in your backup. No toys or play history exist on this device yet, so nothing else is lost.',
    };
  }

  return { eligible: true, replacesSetup: false };
}

/**
 * Clears the rows setup created, so a restore's own ids cannot collide.
 *
 * Only ever reached when `checkRestoreEligibility` has already established
 * there are no toys and no play sessions, which is what makes this safe: there
 * is nothing here a family would miss, and the foreign keys that would make a
 * partial delete dangerous have nothing pointing at them.
 */
export async function clearSetupPlaceholders(database: DatabaseConnection, householdId: string): Promise<void> {
  await database.withTransactionAsync(async () => {
    await database.runAsync('DELETE FROM storage_spots WHERE household_id = ?;', householdId);
    await database.runAsync('DELETE FROM rooms WHERE household_id = ?;', householdId);
    await database.runAsync('UPDATE settings SET active_child_id = NULL WHERE id = 1;');
    await database.runAsync('DELETE FROM child_profiles WHERE household_id = ?;', householdId);
  });
}

export type RestoreSkip = { entity: SyncEntity; localId: number; reason: string };

export type RestoreSummary = {
  rooms: number;
  storageSpots: number;
  toys: number;
  childProfiles: number;
  playSessions: number;
  skipped: RestoreSkip[];
};

/**
 * Applies pulled rows into the local database.
 *
 * Two different households sharing an ordinary room name is not an error —
 * `rooms` is uniquely constrained per household (migration 17), so that case
 * restores normally and produces no skip. What lands in `RestoreSkip` now is
 * only what it should always have meant: a row this device genuinely could
 * not write — a foreign key the rest of the payload never supplied, a value
 * that fails a check constraint, truly corrupt data. Each row is written in
 * its own attempt so one such row does not abort the rest of a family's
 * library, and a skip is reported, never silent: `RestoreSkip` is what a
 * parent-facing recovery screen reads to say precisely what did not come back
 * and why.
 *
 * Applied in dependency order: a storage spot needs its room to exist, a toy
 * needs both, a play session needs its toy.
 */
export async function applyRestoredRows(
  database: DatabaseConnection,
  householdId: string,
  rows: readonly RemoteRow[],
): Promise<RestoreSummary> {
  const summary: RestoreSummary = { rooms: 0, storageSpots: 0, toys: 0, childProfiles: 0, playSessions: 0, skipped: [] };
  const order: SyncEntity[] = ['room', 'child_profile', 'storage_spot', 'toy', 'play_session'];

  for (const entity of order) {
    for (const row of rows.filter((candidate) => candidate.entity === entity)) {
      if (row.deletedAt) continue; // A tombstone from the server; nothing to restore.
      try {
        await applyOneRow(database, householdId, row);
        incrementSummary(summary, entity);
      } catch (caught: unknown) {
        summary.skipped.push({ entity, localId: row.localId, reason: skipReason(caught) });
      }
    }
  }

  return summary;
}

function incrementSummary(summary: RestoreSummary, entity: SyncEntity): void {
  if (entity === 'room') summary.rooms += 1;
  else if (entity === 'storage_spot') summary.storageSpots += 1;
  else if (entity === 'toy') summary.toys += 1;
  else if (entity === 'child_profile') summary.childProfiles += 1;
  else if (entity === 'play_session') summary.playSessions += 1;
}

/**
 * `instanceof Error` is not reliable here: a native SQLite binding's error,
 * carried through Babel's regenerator-transformed async/await, can cross a
 * realm boundary and fail that check even though it is a completely ordinary
 * error with a real `.message` — losing the actual reason a row could not be
 * restored is exactly the kind of silent downgrade a skip report exists to
 * avoid, so the message is read structurally rather than trusting the
 * prototype chain.
 */
function skipReason(caught: unknown): string {
  if (caught instanceof Error) return caught.message;
  if (typeof caught === 'object' && caught !== null && 'message' in caught && typeof caught.message === 'string') {
    return caught.message;
  }
  return 'Could not be restored.';
}

async function applyOneRow(database: DatabaseConnection, householdId: string, row: RemoteRow): Promise<void> {
  const timestamp = now();
  switch (row.entity) {
    case 'room':
      await database.runAsync(
        'INSERT INTO rooms (id, name, household_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?);',
        row.localId,
        String(row.data.name),
        householdId,
        timestamp,
        timestamp,
      );
      return;

    case 'storage_spot':
      await database.runAsync(
        'INSERT INTO storage_spots (id, room_id, name, household_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?);',
        row.localId,
        Number(row.data.roomLocalId),
        String(row.data.name),
        householdId,
        timestamp,
        timestamp,
      );
      return;

    case 'child_profile':
      await database.runAsync(
        `INSERT INTO child_profiles
           (id, name, household_id, avatar_id, accent_color_id, age_range, choice_limit, reading_support, display_order, hidden_at, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
        row.localId,
        String(row.data.name),
        householdId,
        String(row.data.avatarId ?? 'circle-dot'),
        String(row.data.accentColorId ?? 'mint'),
        row.data.ageRange ? String(row.data.ageRange) : null,
        Number(row.data.choiceLimit ?? 3),
        String(row.data.readingSupport ?? 'pictures-words'),
        Number(row.data.displayOrder ?? 0),
        row.data.hiddenAt ? String(row.data.hiddenAt) : null,
        timestamp,
        timestamp,
      );
      return;

    case 'toy': {
      // The image, if any, is imported by the caller through the canonical
      // image pipeline before this runs; `imageUri` here is already a local
      // managed path, never a remote URL Pip would otherwise depend on.
      const categories = Array.isArray(row.data.categories) ? (row.data.categories as string[]) : [];
      await database.withTransactionAsync(async () => {
        await database.runAsync(
          `INSERT INTO toys
             (id, name, image_uri, original_image_uri, room_id, storage_spot_id, cleanup_difficulty, adult_help_required, is_available, is_archived, household_id, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
          row.localId,
          String(row.data.name),
          row.data.imageUri ? String(row.data.imageUri) : null,
          row.data.imageUri ? String(row.data.imageUri) : null,
          Number(row.data.roomLocalId),
          Number(row.data.storageSpotLocalId),
          String(row.data.cleanupDifficulty ?? 'easy'),
          row.data.adultHelpRequired ? 1 : 0,
          row.data.isAvailable === false ? 0 : 1,
          row.data.isArchived ? 1 : 0,
          householdId,
          timestamp,
          timestamp,
        );
        for (const category of categories) {
          await database.runAsync(
            'INSERT INTO toy_categories (toy_id, category, created_at) VALUES (?, ?, ?);',
            row.localId,
            category,
            timestamp,
          );
        }
      });
      return;
    }

    case 'play_session': {
      // 'interrupted' is a remote-only status — the local schema has never
      // needed it, since it exists purely to describe how a sync conflict
      // settled. Restoring one lands as a completed session; the recovery
      // event that came with the conflict is what tells the parent why.
      const status = row.data.status === 'active' ? 'active' : 'completed';
      await database.runAsync(
        `INSERT INTO play_sessions
           (id, child_id, toy_id, status, started_at, completed_at, household_id, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?);`,
        row.localId,
        row.data.childLocalId ? Number(row.data.childLocalId) : null,
        Number(row.data.toyLocalId),
        status,
        String(row.data.startedAt ?? timestamp),
        status === 'completed' ? String(row.data.completedAt ?? row.data.interruptedAt ?? timestamp) : null,
        householdId,
        timestamp,
        timestamp,
      );
      return;
    }
  }
}

/** Ensures the remote household exists and this device's household knows its id. */
export async function ensureRemoteHousehold(
  database: DatabaseConnection,
  gateway: RemoteHouseholdGateway,
  householdId: string,
): Promise<string> {
  const household = await getHousehold(database, householdId);
  if (household?.remoteId) return household.remoteId;
  const name = household?.name ?? 'My Pip';
  const { remoteHouseholdId } = await gateway.findOrCreateHousehold(householdId, name);
  await connectHouseholdToAccount(database, householdId, remoteHouseholdId);
  return remoteHouseholdId;
}

/** Records the household's new high-water mark after a successful pull. */
export async function markSyncedRevision(
  database: DatabaseConnection,
  householdId: string,
  revision: number,
): Promise<void> {
  await database.runAsync(
    `INSERT INTO household_sync_state (household_id, last_synced_revision, updated_at) VALUES (?, ?, ?)
     ON CONFLICT(household_id) DO UPDATE SET
       last_synced_revision = MAX(last_synced_revision, excluded.last_synced_revision),
       updated_at = excluded.updated_at;`,
    householdId,
    revision,
    now(),
  );
}

export async function getSyncedRevision(database: DatabaseConnection, householdId: string): Promise<number> {
  const row = await database.getFirstAsync<{ last_synced_revision: number }>(
    'SELECT last_synced_revision FROM household_sync_state WHERE household_id = ?;',
    householdId,
  );
  return row?.last_synced_revision ?? 0;
}

/** Queues the one line a parent may see for an automatic recovery. Never for an ordinary converging edit. */
export async function recordRecoveryEvent(
  database: DatabaseConnection,
  householdId: string,
  entity: SyncEntity,
  localId: number,
  reason: ConflictReason,
  message: string,
): Promise<void> {
  await database.runAsync(
    `INSERT INTO sync_recovery_events (household_id, entity, entity_local_id, reason, message, created_at)
     VALUES (?, ?, ?, ?, ?, ?);`,
    householdId,
    entity,
    localId,
    reason,
    message,
    now(),
  );
}

export type SyncRecoveryEvent = {
  id: number;
  entity: SyncEntity;
  entityLocalId: number | null;
  reason: ConflictReason;
  message: string;
  createdAt: string;
};

/** Unacknowledged recovery notifications, oldest first — for one lightweight banner, not a screen. */
export async function listUnacknowledgedRecoveryEvents(
  database: DatabaseConnection,
  householdId: string,
): Promise<SyncRecoveryEvent[]> {
  const rows = await database.getAllAsync<{
    id: number; entity: SyncEntity; entity_local_id: number | null; reason: ConflictReason; message: string; created_at: string;
  }>(
    `SELECT id, entity, entity_local_id, reason, message, created_at FROM sync_recovery_events
      WHERE household_id = ? AND acknowledged_at IS NULL ORDER BY created_at ASC;`,
    householdId,
  );
  return rows.map((row) => ({
    id: row.id,
    entity: row.entity,
    entityLocalId: row.entity_local_id,
    reason: row.reason,
    message: row.message,
    createdAt: row.created_at,
  }));
}

export async function acknowledgeRecoveryEvent(database: DatabaseConnection, id: number): Promise<void> {
  await database.runAsync('UPDATE sync_recovery_events SET acknowledged_at = ? WHERE id = ?;', now(), id);
}
