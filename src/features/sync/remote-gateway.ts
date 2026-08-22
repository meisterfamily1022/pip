import type { ConflictReason, SyncEntity, WriteIntent } from './conflict-resolution';

/**
 * Everything the sync service needs from the network, named as operations
 * rather than as HTTP calls, so the service and its tests never depend on
 * supabase-js directly. `supabase-household-gateway.ts` is the only file that
 * talks to the wire; everything else here is provable with an in-memory fake.
 */

/** What the server currently holds for one record, as CAS reports it. */
export type RemoteRecord = {
  revision: number;
  intent: WriteIntent;
};

export type CasResult =
  /** The expected revision matched (or the record was new). New revision assigned. */
  | { outcome: 'applied'; revision: number }
  /** Someone else wrote first. This is what actually happened server-side. */
  | { outcome: 'conflict'; server: RemoteRecord };

/** One row as it exists remotely, for pulling into a fresh or resuming local database. */
export type RemoteRow = {
  entity: SyncEntity;
  localId: number;
  revision: number;
  deletedAt: string | null;
  intent: WriteIntent;
  data: Record<string, unknown>;
};

export interface RemoteHouseholdGateway {
  /**
   * Finds the remote household this device's household backs up to, creating
   * it on the first call. Idempotent on `(ownerId, localHouseholdId)`, so a
   * retried first sync reattaches instead of creating a second library.
   */
  findOrCreateHousehold(localHouseholdId: string, name: string): Promise<{ remoteHouseholdId: string }>;

  /**
   * Proposes a write with the revision the caller last saw for this record
   * (`null` if it has never synced). The server accepts or reports what it
   * actually holds — it never accepts a client's opinion of "now".
   */
  writeRecord(
    remoteHouseholdId: string,
    entity: SyncEntity,
    localId: number,
    expectedRevision: number | null,
    intent: WriteIntent,
    /**
     * The full row an edit persists — name, room, categories, and so on.
     * `WriteIntent` deliberately carries only what the conflict decision
     * needs (`photoPath`, `sessionActive`); everything else a real write
     * requires goes here, entity-shaped and opaque to the sync service.
     * Omitted for a delete, where there is nothing to write.
     */
    data?: Record<string, unknown>,
  ): Promise<CasResult>;

  /** Records what a conflict resolution discarded, so it can be recovered. */
  archiveConflict(
    remoteHouseholdId: string,
    entity: SyncEntity,
    localId: number,
    reason: ConflictReason,
    archived: WriteIntent,
  ): Promise<void>;

  /** Records a photo path a conflict resolution replaced. The object itself is left in the bucket. */
  archiveImagePath(remoteHouseholdId: string, toyLocalId: number, imagePath: string): Promise<void>;

  /**
   * Whether the signed-in account owns this remote household.
   *
   * A device keeps the remote id it was linked to, and the parent may since
   * have signed in as somebody else. Without asking, every write in the run is
   * refused one at a time by row-level security, and the parent is shown a
   * pile of failures instead of the one fact that explains them.
   */
  ownsHousehold(remoteHouseholdId: string): Promise<boolean>;

  /** Everything with a higher revision than the household has already pulled, oldest first. */
  fetchChangesSince(remoteHouseholdId: string, revision: number): Promise<RemoteRow[]>;

  /** Uploads a photo's bytes and returns the path it was stored at. */
  uploadImage(remoteHouseholdId: string, toyLocalId: number, localUri: string): Promise<{ path: string }>;

  /** Downloads a photo's bytes to a local temp file, for import into the canonical image pipeline. */
  downloadImage(remoteHouseholdId: string, path: string): Promise<{ tempUri: string }>;

  /**
   * Permanently removes a photo's object from remote storage — the one case
   * where a bucket object is meant to stop existing rather than be archived,
   * because the toy it belonged to is gone: after a delete, or after an
   * ordinary replace once the new photo has uploaded and pushed successfully.
   */
  deleteImage(remoteHouseholdId: string, path: string): Promise<void>;
}
