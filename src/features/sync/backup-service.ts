import type { DatabaseConnection } from '@/database/types';
import type { ToyImageStorage } from '@/features/toys/toy-image-storage';

import type { SyncEntity } from './conflict-resolution';
import { downloadAndImportToyImage, uploadToyImageIfChanged } from './image-pipeline';
import { markOperation, planLibraryImport, requeueInterrupted } from './library-connection';
import type { RemoteHouseholdGateway, RemoteRow } from './remote-gateway';
import {
  applyRestoredRows,
  checkRestoreEligibility,
  clearSetupPlaceholders,
  ensureRemoteHousehold,
  getSyncedRevision,
  markSyncedRevision,
  pullChanges,
  pushRecord,
  recordRecoveryEvent,
  type RestoreSummary,
} from './sync-service';

/**
 * Backing a household up, and restoring it — the orchestration the screens call.
 *
 * `sync-service.ts` knows how to write one record safely and how to apply a
 * pulled row. This is the layer above: which records to send, in what order,
 * what to do with a photograph, and what happens when the network is not there
 * halfway through. It exists because that middle is where a backup feature
 * actually fails a family — not in the protocol, but in a run that stops at toy
 * forty of sixty and has to be resumable without duplicating the first
 * thirty-nine.
 *
 * Every unit of work is a row in `sync_operations`, keyed by
 * `(entity, entity_id, household_id)`. That is what makes a retry resume: a
 * record already `done` is never sent twice, and a device that loses power
 * mid-run comes back with its queue intact.
 */

export type BackupDeps = {
  database: DatabaseConnection;
  gateway: RemoteHouseholdGateway;
  storage: ToyImageStorage;
  householdId: string;
  onProgress?: (progress: BackupProgress) => void;
};

export class BackupNotYoursError extends Error {}

export type BackupProgress = { completed: number; total: number; photosUploaded: number };

export type BackupFailure = { entity: SyncEntity; localId: number; reason: string };

export type BackupResult = {
  remoteHouseholdId: string;
  sent: number;
  photosUploaded: number;
  recovered: number;
  /** Still outstanding: left queued, so the next run picks them up. */
  failures: BackupFailure[];
};

/** The order the backup schema's foreign keys require. */
const ORDER: readonly SyncEntity[] = ['room', 'child_profile', 'storage_spot', 'toy', 'play_session'] as const;

const ENTITY_TABLE: Record<SyncEntity, string> = {
  room: 'rooms',
  child_profile: 'child_profiles',
  storage_spot: 'storage_spots',
  toy: 'toys',
  play_session: 'play_sessions',
};

/**
 * A network failure is not a data failure.
 *
 * A row that could not be sent because the phone is in a lift must stay
 * `pending` and be retried; a row the server actively rejected is `failed` and
 * needs a person. Conflating them either spams a broken write forever or
 * silently abandons a toy the moment a tunnel interrupts an upload.
 */
export function isTransient(reason: string): boolean {
  return /network|offline|timed? ?out|timeout|connection|fetch|unreachable|econn|socket|temporar/i.test(reason);
}

const messageOf = (caught: unknown): string => {
  if (caught instanceof Error) return caught.message;
  if (typeof caught === 'object' && caught !== null && 'message' in caught && typeof caught.message === 'string') {
    return caught.message;
  }
  return 'Could not be sent.';
};

type LocalRow = { id: number; [column: string]: unknown };

async function readLocalRows(database: DatabaseConnection, entity: SyncEntity, householdId: string): Promise<LocalRow[]> {
  return database.getAllAsync<LocalRow>(
    `SELECT * FROM "${ENTITY_TABLE[entity]}" WHERE household_id = ? ORDER BY id;`,
    householdId,
  );
}

async function categoriesOf(database: DatabaseConnection, toyId: number): Promise<string[]> {
  const rows = await database.getAllAsync<{ category: string }>(
    'SELECT category FROM toy_categories WHERE toy_id = ? ORDER BY category;',
    toyId,
  );
  return rows.map((row) => row.category);
}

/** One local row as the fields the sync service and the backup schema share. */
async function recordFor(database: DatabaseConnection, entity: SyncEntity, row: LocalRow): Promise<Record<string, unknown>> {
  switch (entity) {
    case 'room':
      return { name: row.name };
    case 'storage_spot':
      return { name: row.name, roomLocalId: row.room_id };
    case 'child_profile':
      return {
        name: row.name,
        avatarId: row.avatar_id,
        accentColorId: row.accent_color_id,
        ageRange: row.age_range,
        choiceLimit: row.choice_limit,
        readingSupport: row.reading_support,
        displayOrder: row.display_order,
        hiddenAt: row.hidden_at,
      };
    case 'toy':
      return {
        name: row.name,
        roomLocalId: row.room_id,
        storageSpotLocalId: row.storage_spot_id,
        cleanupDifficulty: row.cleanup_difficulty,
        adultHelpRequired: row.adult_help_required === 1,
        isAvailable: row.is_available === 1,
        isArchived: row.is_archived === 1,
        availabilityScope: row.availability_scope,
        categories: await categoriesOf(database, row.id),
      };
    case 'play_session':
      return {
        childLocalId: row.child_id,
        toyLocalId: row.toy_id,
        status: row.status,
        startedAt: row.started_at,
        completedAt: row.completed_at,
      };
  }
}

/**
 * Sends everything in this household that is not already backed up.
 *
 * Safe to call again at any point: `planLibraryImport` only queues what is not
 * already queued, and a record marked `done` is skipped. Interrupted work is
 * returned to the queue first, so a run that died mid-flight resumes rather
 * than stalling on rows stuck `in_flight` forever.
 */
export async function backUpHousehold(deps: BackupDeps): Promise<BackupResult> {
  const { database, gateway, storage, householdId, onProgress } = deps;

  const remoteHouseholdId = await ensureRemoteHousehold(database, gateway, householdId);
  // Asked once, before anything is attempted. Otherwise a parent who has since
  // signed in as somebody else watches every record fail separately and is
  // told nothing that explains it.
  if (!(await gateway.ownsHousehold(remoteHouseholdId))) {
    throw new BackupNotYoursError(
      'This library is already backed up to a different Pip account. Sign in with that account to back it up, or use Reset Pip to start this device fresh.',
    );
  }
  await requeueInterrupted(database, householdId);
  await planLibraryImport(database, householdId);

  const outstanding = await database.getAllAsync<{ entity: SyncEntity; entity_id: string }>(
    "SELECT entity, entity_id FROM sync_operations WHERE household_id = ? AND status != 'done';",
    householdId,
  );
  const pending = new Set(outstanding.map((row) => `${row.entity}:${row.entity_id}`));

  const failures: BackupFailure[] = [];
  let sent = 0;
  let photosUploaded = 0;
  let recovered = 0;
  const total = pending.size;

  for (const entity of ORDER) {
    for (const row of await readLocalRows(database, entity, householdId)) {
      if (!pending.has(`${entity}:${row.id}`)) continue;

      await markOperation(database, entity, String(row.id), { status: 'in_flight' }, householdId);
      try {
        const data = await recordFor(database, entity, row);
        let photoPath: string | null = null;

        if (entity === 'toy' && typeof row.image_uri === 'string' && row.image_uri) {
          // The photograph goes first: a toy row that names a path whose bytes
          // never uploaded would restore as a toy with a broken picture, which
          // is worse than one that restores without a picture at all.
          const upload = await uploadToyImageIfChanged(
            gateway, storage, remoteHouseholdId, row.id, row.image_uri,
            typeof row.image_synced_fingerprint === 'string' ? row.image_synced_fingerprint : null,
          );
          if (upload.uploaded) {
            photoPath = upload.path;
            photosUploaded += 1;
            data.imagePath = upload.path;
            data.imageUploadedAt = new Date().toISOString();
            await database.runAsync(
              'UPDATE toys SET image_synced_fingerprint = ? WHERE id = ?;',
              upload.fingerprint,
              row.id,
            );
          }
        }

        const outcome = await pushRecord(
          gateway, remoteHouseholdId, entity, row.id, null,
          entity === 'toy'
            ? { kind: 'edit', photoPath }
            : entity === 'play_session'
              ? { kind: 'edit', sessionActive: row.status === 'active' }
              : { kind: 'edit' },
          data,
        );

        if (outcome.outcome === 'recovered') {
          recovered += 1;
          await recordRecoveryEvent(database, householdId, entity, row.id, outcome.reason, outcome.notify);
        }

        await markOperation(database, entity, String(row.id), { status: 'done' }, householdId);
        await markSyncedRevision(database, householdId, outcome.revision);
        sent += 1;
      } catch (caught: unknown) {
        const reason = messageOf(caught);
        failures.push({ entity, localId: row.id, reason });
        await markOperation(
          database, entity, String(row.id),
          // Transient stays pending so the next run simply picks it up again.
          { status: isTransient(reason) ? 'pending' : 'failed', lastError: reason },
          householdId,
        );
      }
      onProgress?.({ completed: sent + failures.length, total, photosUploaded });
    }
  }

  return { remoteHouseholdId, sent, photosUploaded, recovered, failures };
}

export type RestoreOutcome =
  | { restored: false; reason: string; needsConfirmation?: boolean }
  | { restored: true; summary: RestoreSummary; photosRestored: number; photosMissing: number };

/**
 * Brings a household back onto a device that has nothing.
 *
 * Photographs are downloaded and imported through the same managed-storage
 * path a camera capture uses, before the toy row is written, so a restored toy
 * points at a real local file rather than at a URL whose availability Pip would
 * then depend on forever. A photo that cannot be fetched is counted and the toy
 * is still restored — a library missing one picture is worth far more to a
 * family than no library at all.
 */
export async function restoreHousehold(
  deps: BackupDeps,
  /**
   * Set once the parent has agreed to replace what setup created. Without it a
   * device that has been through setup is reported as needing confirmation
   * rather than quietly having its room and child replaced.
   */
  options: { replaceSetup?: boolean } = {},
): Promise<RestoreOutcome> {
  const { database, gateway, storage, householdId } = deps;

  const eligibility = await checkRestoreEligibility(database, householdId);
  if (!eligibility.eligible) return { restored: false, reason: eligibility.message };
  if (eligibility.replacesSetup && !options.replaceSetup) {
    return { restored: false, needsConfirmation: true, reason: eligibility.message };
  }

  const remoteHouseholdId = await ensureRemoteHousehold(database, gateway, householdId);
  const since = await getSyncedRevision(database, householdId);
  const { rows, latestRevision } = await pullChanges(gateway, remoteHouseholdId, since);
  if (rows.length === 0) {
    return { restored: false, reason: 'There is no backup for this account yet.' };
  }

  let photosRestored = 0;
  let photosMissing = 0;
  const prepared: RemoteRow[] = [];

  for (const row of rows) {
    if (row.entity !== 'toy' || row.deletedAt) { prepared.push(row); continue; }
    const imagePath = typeof row.data.imagePath === 'string' ? row.data.imagePath : null;
    if (!imagePath) { prepared.push(row); continue; }
    try {
      const { localUri } = await downloadAndImportToyImage(gateway, storage, remoteHouseholdId, imagePath);
      prepared.push({ ...row, data: { ...row.data, imageUri: localUri } });
      photosRestored += 1;
    } catch {
      // Counted, never fatal, and never silent: the caller reports it.
      photosMissing += 1;
      prepared.push(row);
    }
  }

  // Last possible moment, and only after every photograph is already on disk:
  // if the download stage had thrown, the device would still have what setup
  // gave it rather than nothing at all.
  if (eligibility.replacesSetup) await clearSetupPlaceholders(database, householdId);

  const summary = await applyRestoredRows(database, householdId, prepared);
  await markSyncedRevision(database, householdId, latestRevision);
  return { restored: true, summary, photosRestored, photosMissing };
}
