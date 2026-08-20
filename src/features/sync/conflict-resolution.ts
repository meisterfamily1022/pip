/**
 * How a write conflict on a synced record is resolved.
 *
 * Governing rules, agreed for this feature:
 *
 * 1. Default: automatic record-level last-write-wins for ordinary,
 *    non-destructive edits. No blocking screen — a parent must never be asked
 *    to arbitrate before Pip is usable again.
 * 2. A destructive outcome never silently discards the losing side:
 *    - edit vs delete: the deletion is what a family sees, but the edited
 *      content is archived and recoverable, never dropped;
 *    - photo replaced on both sides: the newer photo shows normally, the
 *      other is kept as recoverable history, not deleted from the bucket;
 *    - two active play sessions for the same child: the newer one stays
 *      active, the older is closed as `interrupted`, not left dangling.
 * 3. Every automatic resolution that discarded something is logged as an
 *    internal diagnostic and queued as one lightweight, non-blocking parent
 *    notification — never a screen that blocks ordinary use.
 *
 * The part that makes rule 4 — "server-assigned revision is the final
 * authority, not arbitrary client clocks" — actually true rather than
 * aspirational is the protocol, not this module: every synced table carries a
 * `revision` a Postgres trigger assigns from a shared sequence, and a client
 * writes with `UPDATE ... WHERE id = ? AND revision = ?`. Two clients editing
 * the same row is not "compare two timestamps from two clocks" — it is
 * "whichever write reaches the server's sequence first gets the next
 * revision; the other one's WHERE clause matches zero rows." A conflict is
 * detected by that mismatch, not by comparing when either device thinks it
 * made the edit. This module is the *pure* decision of what to do once a
 * mismatch has been detected, given the two intents involved — it takes no
 * timestamp as an input, because none is trustworthy, and that omission is
 * deliberate rather than an oversight.
 */

export type SyncEntity = 'room' | 'storage_spot' | 'toy' | 'child_profile' | 'play_session';

/** What a write proposes to do, stripped to what conflict resolution needs to know. */
export type WriteIntent =
  | { kind: 'edit'; photoPath?: string | null; sessionActive?: boolean }
  | { kind: 'delete' };

/** The row as the server currently holds it, when a write's expected revision did not match. */
export type ServerRecord = {
  revision: number;
  intent: WriteIntent;
};

export type ConflictReason = 'edited-and-deleted' | 'photo-replaced' | 'competing-active-sessions';

export type WriteOutcome =
  /** No conflict: expected revision matched, or the record did not exist yet. Apply as proposed. */
  | { kind: 'applied' }
  /**
   * A conflict existed but nothing destructive was at stake — two ordinary
   * edits landed close together. The incoming write is applied as the new
   * current state; nothing is archived because nothing is lost, only
   * superseded, which is what "last write wins" means for a non-destructive
   * field.
   */
  | { kind: 'applied-over-conflict' }
  /**
   * A conflict where one side is applied and the other is preserved rather
   * than discarded. `archive` describes what must be written to
   * `conflict_archive` (or `toy_image_history` for a photo) so the losing
   * side is recoverable, and `notify` is the one line a parent may see.
   */
  | { kind: 'resolved-with-archive'; reason: ConflictReason; winner: 'incoming' | 'server'; archive: WriteIntent; notify: string }
  /**
   * Both sides are the same play session going stale in the same way (e.g.
   * both already completed). Converges with nothing to archive and nothing to
   * tell anyone.
   */
  | { kind: 'converged' };

/**
 * Resolves one detected conflict. Called only after a CAS write's WHERE
 * clause matched zero rows — `server` is what actually won the race.
 */
export function resolveConflict(
  entity: SyncEntity,
  server: ServerRecord | null,
  incoming: WriteIntent,
): WriteOutcome {
  if (!server) return { kind: 'applied' };

  const serverDeleted = server.intent.kind === 'delete';
  const incomingDeleted = incoming.kind === 'delete';

  // Both sides agree the record is gone. Deletion is idempotent, so this is
  // not a conflict worth telling anyone about.
  if (serverDeleted && incomingDeleted) return { kind: 'converged' };

  // One side deleted, the other holds real content. The deletion is what the
  // family sees — reappearing records look like a bug, not a recovery — but
  // the content that would otherwise vanish is archived, not dropped.
  if (serverDeleted !== incomingDeleted) {
    const edited = serverDeleted ? incoming : server.intent;
    return {
      kind: 'resolved-with-archive',
      reason: 'edited-and-deleted',
      winner: serverDeleted ? 'server' : 'incoming',
      archive: edited,
      notify: describeEntity(entity, 'was deleted on another device. The edited version was kept and can be recovered from history.'),
    };
  }

  // Both sides are edits. A photo changed on both sides is destructive in a
  // way an ordinary field edit is not — a photograph cannot be regenerated —
  // so the losing one is archived instead of silently overwritten.
  const serverPhoto = server.intent.kind === 'edit' ? server.intent.photoPath : undefined;
  const incomingPhoto = incoming.kind === 'edit' ? incoming.photoPath : undefined;
  if (serverPhoto !== undefined && incomingPhoto !== undefined && serverPhoto !== incomingPhoto) {
    return {
      kind: 'resolved-with-archive',
      reason: 'photo-replaced',
      winner: 'incoming',
      archive: server.intent,
      notify: describeEntity(entity, 'photo was changed on another device too. The other photo was kept in history.'),
    };
  }

  // Two devices each believe a child is mid-play with an active session.
  // Ending one silently would look like Pip forgot a child was playing, so the
  // older one is explicitly closed as interrupted rather than just discarded.
  if (
    entity === 'play_session'
    && server.intent.kind === 'edit' && server.intent.sessionActive
    && incoming.kind === 'edit' && incoming.sessionActive
  ) {
    return {
      kind: 'resolved-with-archive',
      reason: 'competing-active-sessions',
      winner: 'incoming',
      archive: server.intent,
      notify: 'A play session open on two devices was recovered — the older one was closed automatically.',
    };
  }

  // An ordinary field edit on both sides. The incoming write is what is
  // happening *now*, in server-arrival order — that is the entire content of
  // "last write wins" once no client clock is allowed to decide it.
  return { kind: 'applied-over-conflict' };
}

const ENTITY_LABEL: Record<SyncEntity, string> = {
  room: 'A room',
  storage_spot: 'A storage spot',
  toy: 'A toy',
  child_profile: 'A child profile',
  play_session: 'A play session',
};

function describeEntity(entity: SyncEntity, suffix: string): string {
  return `${ENTITY_LABEL[entity]} ${suffix}`;
}
