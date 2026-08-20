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

  /** Everything with a higher revision than the household has already pulled, oldest first. */
  fetchChangesSince(remoteHouseholdId: string, revision: number): Promise<RemoteRow[]>;

  /** Uploads a photo's bytes and returns the path it was stored at. */
  uploadImage(remoteHouseholdId: string, toyLocalId: number, localUri: string): Promise<{ path: string }>;

  /** Downloads a photo's bytes to a local temp file, for import into the canonical image pipeline. */
  downloadImage(remoteHouseholdId: string, path: string): Promise<{ tempUri: string }>;
}
