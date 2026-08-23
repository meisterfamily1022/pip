import type { DatabaseConnection } from '@/database/types';

/**
 * What the Account screen needs to say about backup, and nothing more.
 *
 * Deliberately derived from the queue and the high-water mark rather than from
 * a "backed up" flag, because a flag can be true while sixty toys sit unsent.
 * The number a parent needs is how much is *not* backed up, and whether the
 * last attempt left anything stuck.
 */

export type BackupStatus = {
  /** True once this household has a remote counterpart. */
  linked: boolean;
  /** Records queued and not yet sent, including ones a lost connection interrupted. */
  waiting: number;
  /** Records the server rejected. These need a person, not another retry. */
  failed: number;
  /** Records confirmed sent. */
  sent: number;
  /** When the last record was confirmed, ISO, or null if none ever has been. */
  lastBackupAt: string | null;
  /** Whether the device holds a library at all. */
  hasLibrary: boolean;
};

export async function loadBackupStatus(
  database: DatabaseConnection,
  householdId: string,
): Promise<BackupStatus> {
  const household = await database.getFirstAsync<{ remote_id: string | null }>(
    'SELECT remote_id FROM households WHERE id = ?;',
    householdId,
  );

  const counts = await database.getAllAsync<{ status: string; count: number }>(
    'SELECT status, COUNT(*) AS count FROM sync_operations WHERE household_id = ? GROUP BY status;',
    householdId,
  );
  const by = (status: string): number => counts.find((row) => row.status === status)?.count ?? 0;

  const state = await database.getFirstAsync<{ updated_at: string }>(
    'SELECT updated_at FROM household_sync_state WHERE household_id = ?;',
    householdId,
  );

  const library = await database.getFirstAsync<{ count: number }>(
    'SELECT COUNT(*) AS count FROM toys WHERE household_id = ?;',
    householdId,
  );

  return {
    linked: Boolean(household?.remote_id),
    // 'in_flight' belongs here: a run killed mid-record leaves rows there, and
    // they are outstanding work however they are labelled.
    waiting: by('pending') + by('in_flight'),
    failed: by('failed'),
    sent: by('done'),
    lastBackupAt: state?.updated_at ?? null,
    hasLibrary: (library?.count ?? 0) > 0,
  };
}

/** One line, in a parent's terms, that is true of every state this can be in. */
export function describeBackupStatus(status: BackupStatus): string {
  if (!status.hasLibrary && !status.linked) return 'There is nothing to back up yet. Add a toy first.';
  if (!status.linked) return 'This library has never been backed up.';
  if (status.failed > 0 && status.waiting === 0) {
    return `${status.sent} ${records(status.sent)} backed up. ${status.failed} could not be sent and need another look.`;
  }
  if (status.waiting > 0) {
    return `${status.waiting} ${records(status.waiting)} still to upload. Pip will finish next time you tap Back up now.`;
  }
  return `Everything is backed up — ${status.sent} ${records(status.sent)}.`;
}

const records = (count: number): string => (count === 1 ? 'record' : 'records');

/** Whether restoring is even worth offering. Restore is a clean-install action. */
export function canOfferRestore(status: BackupStatus): boolean {
  return !status.hasLibrary;
}
