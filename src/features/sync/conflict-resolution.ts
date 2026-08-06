/**
 * How two versions of the same record are reconciled.
 *
 * The governing rule from the brief: **never blindly last-write-wins for
 * destructive conflicts involving photos, toys, rooms, or active sessions.**
 *
 * A clock skew of a few seconds between two devices should never be enough to
 * silently delete a toy someone edited, or replace a photograph that cannot be
 * recovered. Where a decision would destroy something irreplaceable, this
 * returns `needs-review` and the parent is asked. Everywhere else, converging
 * automatically is fine.
 */

export type SyncEntity = 'room' | 'storage_spot' | 'toy' | 'child_profile' | 'play_session';

export type RecordVersion = {
  /** ISO timestamp of the last edit on that side. */
  updatedAt: string;
  /** Set when that side deleted the record. */
  deletedAt?: string | null;
  /** Photo the record points at. Changing it is treated as destructive. */
  photoUri?: string | null;
  /** True while a play session is open on that side. */
  sessionActive?: boolean;
};

export type Resolution =
  | { kind: 'keep-local' }
  | { kind: 'take-remote' }
  | { kind: 'already-equal' }
  | { kind: 'needs-review'; reason: ConflictReason };

export type ConflictReason =
  | 'edited-and-deleted'
  | 'photo-replaced'
  | 'both-sessions-active'
  | 'same-timestamp';

const changedSince = (version: RecordVersion, lastSyncedAt: string | null): boolean =>
  lastSyncedAt === null || version.updatedAt > lastSyncedAt || Boolean(version.deletedAt && version.deletedAt > lastSyncedAt);

/**
 * Reconciles one record.
 *
 * `lastSyncedAt` is the point both sides agreed. A side that has not changed
 * since then has nothing to contribute, so the other side simply wins without
 * being a conflict at all.
 */
export function resolveConflict(
  entity: SyncEntity,
  local: RecordVersion,
  remote: RecordVersion,
  lastSyncedAt: string | null,
): Resolution {
  const localChanged = changedSince(local, lastSyncedAt);
  const remoteChanged = changedSince(remote, lastSyncedAt);

  if (!localChanged && !remoteChanged) return { kind: 'already-equal' };
  if (localChanged && !remoteChanged) return { kind: 'keep-local' };
  if (!localChanged && remoteChanged) return { kind: 'take-remote' };

  // Both sides changed from here on.

  const localDeleted = Boolean(local.deletedAt);
  const remoteDeleted = Boolean(remote.deletedAt);

  // Both removed it. Deletion is idempotent, so this converges safely.
  if (localDeleted && remoteDeleted) return { kind: 'take-remote' };

  // One deleted while the other edited. Applying either answer destroys real
  // work, so a person decides.
  if (localDeleted !== remoteDeleted) return { kind: 'needs-review', reason: 'edited-and-deleted' };

  // A photograph cannot be regenerated. If both sides moved it, ask.
  if (local.photoUri !== undefined && remote.photoUri !== undefined && local.photoUri !== remote.photoUri) {
    return { kind: 'needs-review', reason: 'photo-replaced' };
  }

  // Two devices each believe a child is mid-play. Picking one silently ends a
  // session someone is actually in.
  if (entity === 'play_session' && local.sessionActive && remote.sessionActive) {
    return { kind: 'needs-review', reason: 'both-sessions-active' };
  }

  // Identical timestamps give no basis to choose, and guessing would be
  // arbitrary rather than correct.
  if (local.updatedAt === remote.updatedAt) return { kind: 'needs-review', reason: 'same-timestamp' };

  // Non-destructive edits on both sides: the newer one wins.
  return remote.updatedAt > local.updatedAt ? { kind: 'take-remote' } : { kind: 'keep-local' };
}

/** Human-readable explanation, for the review screen. */
export const CONFLICT_EXPLANATIONS: Record<ConflictReason, string> = {
  'edited-and-deleted': 'This was removed on one device and changed on another. Choose which to keep.',
  'photo-replaced': 'Two devices have different photos for this. Choose which photo to keep.',
  'both-sessions-active': 'Two devices both show this as being played with right now.',
  'same-timestamp': 'Two devices changed this at the same moment. Choose which to keep.',
};

export function isDestructive(resolution: Resolution): boolean {
  return resolution.kind === 'needs-review';
}
