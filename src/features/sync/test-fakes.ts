import type { ToyImageStorage } from '@/features/toys/toy-image-storage';

import type { ConflictReason, SyncEntity, WriteIntent } from './conflict-resolution';
import type { CasResult, RemoteHouseholdGateway, RemoteRow } from './remote-gateway';

/**
 * An in-memory stand-in for the Supabase-backed gateway, so the sync service
 * is provable without a network or a real project. The CAS semantics are the
 * part that matters: this fake enforces the same `revision` compare-and-swap
 * a Postgres `UPDATE ... WHERE revision = ?` does, so a test that exercises
 * two concurrent writers here is testing the real protocol, not a shortcut.
 */
export type FakeRow = { entity: SyncEntity; localId: number; revision: number; deletedAt: string | null; intent: WriteIntent; data: Record<string, unknown> };

export class FakeHouseholdGateway implements RemoteHouseholdGateway {
  private nextRevision = 1;
  readonly rows = new Map<string, FakeRow>();
  readonly archivedConflicts: { entity: SyncEntity; localId: number; reason: ConflictReason; archived: WriteIntent }[] = [];
  readonly archivedImages: { toyLocalId: number; imagePath: string }[] = [];
  readonly uploadedImages: { toyLocalId: number; localUri: string; path: string }[] = [];
  readonly deletedImages: string[] = []; // Never written to by this fake — asserted empty, proving archived images are kept.
  private households = new Map<string, string>();

  private key(entity: SyncEntity, localId: number): string {
    return `${entity}:${localId}`;
  }

  async findOrCreateHousehold(localHouseholdId: string, _name: string): Promise<{ remoteHouseholdId: string }> {
    const existing = this.households.get(localHouseholdId);
    if (existing) return { remoteHouseholdId: existing };
    const remoteHouseholdId = `remote-${localHouseholdId}-${this.households.size + 1}`;
    this.households.set(localHouseholdId, remoteHouseholdId);
    return { remoteHouseholdId };
  }

  async writeRecord(
    _remoteHouseholdId: string,
    entity: SyncEntity,
    localId: number,
    expectedRevision: number | null,
    intent: WriteIntent,
    // Stored rather than ignored. While this was dropped, no test could see
    // whether the record a push sends is the record a restore reads back, and
    // the real gateway's field-name mismatch stayed invisible behind a fake
    // that echoed the intent instead of the row.
    data: Record<string, unknown> = {},
  ): Promise<CasResult> {
    const key = this.key(entity, localId);
    const current = this.rows.get(key) ?? null;
    const currentRevision = current?.revision ?? null;
    if (currentRevision !== expectedRevision) {
      if (!current) throw new Error('Conflict reported with no current row — fake is inconsistent.');
      return { outcome: 'conflict', server: { revision: current.revision, intent: current.intent } };
    }
    const revision = this.nextRevision;
    this.nextRevision += 1;
    const stored = intent.kind === 'edit' ? { ...extractData(intent), ...data } : {};
    this.rows.set(key, {
      entity,
      localId,
      revision,
      deletedAt: intent.kind === 'delete' ? new Date(revision).toISOString() : null,
      intent,
      data: stored,
    });
    return { outcome: 'applied', revision };
  }

  async archiveConflict(
    _remoteHouseholdId: string,
    entity: SyncEntity,
    localId: number,
    reason: ConflictReason,
    archived: WriteIntent,
  ): Promise<void> {
    this.archivedConflicts.push({ entity, localId, reason, archived });
  }

  async archiveImagePath(_remoteHouseholdId: string, toyLocalId: number, imagePath: string): Promise<void> {
    this.archivedImages.push({ toyLocalId, imagePath });
  }

  /** Overridable in a test that needs to model somebody else's household. */
  owned = true;

  async ownsHousehold(_remoteHouseholdId: string): Promise<boolean> {
    return this.owned;
  }

  async fetchChangesSince(_remoteHouseholdId: string, revision: number): Promise<RemoteRow[]> {
    return [...this.rows.values()]
      .filter((row) => row.revision > revision)
      .sort((a, b) => a.revision - b.revision)
      .map((row) => ({ entity: row.entity, localId: row.localId, revision: row.revision, deletedAt: row.deletedAt, intent: row.intent, data: row.data }));
  }

  async uploadImage(_remoteHouseholdId: string, toyLocalId: number, localUri: string): Promise<{ path: string }> {
    const path = `${toyLocalId}/${this.uploadedImages.length}.jpg`;
    this.uploadedImages.push({ toyLocalId, localUri, path });
    return { path };
  }

  async downloadImage(_remoteHouseholdId: string, path: string): Promise<{ tempUri: string }> {
    return { tempUri: `file:///tmp/downloaded/${path}` };
  }
}

function extractData(intent: Extract<WriteIntent, { kind: 'edit' }>): Record<string, unknown> {
  const data: Record<string, unknown> = {};
  // `imagePath`, not `imageUri`: the intent carries the object's key in the
  // bucket, while `imageUri` is the local file a restore writes after importing
  // the bytes. Conflating them here made a restore appear to succeed while
  // leaving every toy pointing at a remote path it could never open.
  if (intent.photoPath !== undefined) data.imagePath = intent.photoPath;
  if (intent.sessionActive !== undefined) data.status = intent.sessionActive ? 'active' : 'completed';
  return data;
}

export class FakeToyImageStorage implements ToyImageStorage {
  readonly copied: string[] = [];
  readonly deleted: (string | null)[] = [];
  private fingerprints = new Map<string, string>();

  setFingerprint(uri: string, fingerprint: string): void {
    this.fingerprints.set(uri, fingerprint);
  }

  async copyIntoManagedStorage(sourceUri: string): Promise<string> {
    const managed = `file:///managed/${sourceUri.split('/').pop()}`;
    this.copied.push(managed);
    const fingerprint = this.fingerprints.get(sourceUri);
    if (fingerprint) this.fingerprints.set(managed, fingerprint);
    return managed;
  }

  async deleteManagedImage(uri: string | null): Promise<void> {
    this.deleted.push(uri);
  }

  async fingerprintImage(uri: string): Promise<string | null> {
    return this.fingerprints.get(uri) ?? uri;
  }
}
