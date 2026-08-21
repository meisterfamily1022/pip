import type { DatabaseConnection } from '@/database/types';
import type { Household } from '@/domain/models';
import { LOCAL_HOUSEHOLD_ID } from '@/database/migrations';
import { getHousehold } from '@/repositories/households-repository';

/**
 * Which household this device is showing, and who is allowed to see it.
 *
 * Pip is local-first, so the rule that matters is not "who is signed in" but
 * "whose library is on screen". Those come apart the moment a second adult uses
 * the same phone, and the whole point of this module is that they can only come
 * apart in safe ways.
 *
 * Three states, and nothing else:
 *
 *  - **Device-local** (`owner_account_id IS NULL`). A family using Pip without
 *    an account. This is the default and stays fully usable forever. It belongs
 *    to the device, not to whoever happens to be signed in, so signing in does
 *    not claim it and signing out does not take it away.
 *  - **Owned** (`owner_account_id = <account>`). A household a parent has
 *    explicitly backed up. It is visible only while that account is signed in.
 *  - **Hidden**. An owned household belonging to somebody who is not signed in
 *    right now. The rows stay on disk — deleting a family's library because
 *    they signed out would be indefensible — but nothing can read them.
 *
 * A household never changes category on its own. It becomes owned only through
 * `backUpHouseholdToAccount`, which is what the parent-facing "Back up this
 * household" confirmation calls. Signing in never silently adopts, merges, or
 * transfers a library.
 */

const now = (): string => new Date().toISOString();

/** Nobody is signed in. The device-local household is the one on screen. */
export const DEVICE_LOCAL_ACCOUNT = null;

export type AccountId = string | null;

export class HouseholdScopeError extends Error {}

/**
 * The household this device is currently showing.
 *
 * Read from the device, not from the session: it has to be answerable during
 * startup before Supabase has restored anything, and it has to survive a
 * relaunch that never reaches the network at all.
 */
export async function getActiveHouseholdId(database: DatabaseConnection): Promise<string> {
  const row = await database.getFirstAsync<{ active_household_id: string }>(
    'SELECT active_household_id FROM device_household_state WHERE id = 1;',
  );
  // Migration 14 seeds this row, so its absence means a database older than the
  // migration — in which case everything is device-local by definition.
  return row?.active_household_id ?? LOCAL_HOUSEHOLD_ID;
}

async function setActiveHouseholdId(database: DatabaseConnection, householdId: string): Promise<void> {
  await database.runAsync(
    `INSERT INTO device_household_state (id, active_household_id, updated_at) VALUES (1, ?, ?)
     ON CONFLICT(id) DO UPDATE SET active_household_id = excluded.active_household_id, updated_at = excluded.updated_at;`,
    householdId,
    now(),
  );
}

/** The household owned by this account on this device, if it has one. */
export async function findHouseholdForAccount(
  database: DatabaseConnection,
  accountId: string,
): Promise<Household | null> {
  const row = await database.getFirstAsync<{ id: string }>(
    'SELECT id FROM households WHERE owner_account_id = ?;',
    accountId,
  );
  return row ? getHousehold(database, row.id) : null;
}

/** The unowned household on this device, if there still is one. */
async function findUnownedHousehold(database: DatabaseConnection): Promise<string | null> {
  const row = await database.getFirstAsync<{ id: string }>(
    `SELECT id FROM households WHERE owner_account_id IS NULL
      ORDER BY (id = ?) DESC, created_at ASC LIMIT 1;`,
    LOCAL_HOUSEHOLD_ID,
  );
  return row?.id ?? null;
}

/**
 * An empty, unowned household for whoever is holding the device.
 *
 * Needed when the original device-local household has been backed up and now
 * belongs to somebody. The next person to use the phone cannot be shown it, and
 * cannot be left with nothing either, so they get a fresh one. It is unowned,
 * like the first one was, and stays that way until somebody explicitly backs it
 * up.
 */
async function createUnownedHousehold(database: DatabaseConnection): Promise<string> {
  const existing = await database.getAllAsync<{ id: string }>('SELECT id FROM households;');
  const id = `${LOCAL_HOUSEHOLD_ID}-${existing.length + 1}`;
  await database.runAsync(
    `INSERT INTO households (id, name, is_local_only, owner_account_id, created_at, updated_at)
     VALUES (?, 'My Pip', 1, NULL, ?, ?);`,
    id,
    now(),
    now(),
  );
  return id;
}

/**
 * Points the device at the household the given account may see.
 *
 * Called on sign-in, on sign-out, on account switch, and on session restore —
 * every transition, by the same rule, so none of them can disagree:
 *
 *  - an account that owns a household here gets that household;
 *  - anyone else gets an unowned household, reused if one exists and created
 *    empty if not.
 *
 * The invariant is the second line, and it is absolute: this function never
 * returns a household somebody else owns. That is what was broken before —
 * every caller resolved to the constant `'local'`, so the second adult to sign
 * in on a phone landed squarely in the first adult's library.
 *
 * A parent signing in for the first time still keeps their existing local
 * library, because it is unowned and gets reused. It does not become the
 * account's; only an explicit backup does that.
 */
export async function activateHouseholdForAccount(
  database: DatabaseConnection,
  accountId: AccountId,
): Promise<string> {
  if (accountId !== DEVICE_LOCAL_ACCOUNT) {
    const owned = await findHouseholdForAccount(database, accountId);
    if (owned) {
      await setActiveHouseholdId(database, owned.id);
      return owned.id;
    }
  }

  const unowned = (await findUnownedHousehold(database)) ?? (await createUnownedHousehold(database));
  await setActiveHouseholdId(database, unowned);
  return unowned;
}

/**
 * Hands the current device-local household to an account, on purpose.
 *
 * This is the only path by which a library acquires an owner, and it exists so
 * that acquiring one is always a thing a parent chose out loud rather than a
 * consequence of tapping Sign in.
 *
 * Refuses rather than reassigns when the household already belongs to somebody:
 * silently re-pointing one family's library at another account is precisely the
 * failure this whole model exists to prevent. Re-running it for the same account
 * is a no-op, so a retried confirmation cannot produce a second household.
 */
export async function backUpHouseholdToAccount(
  database: DatabaseConnection,
  householdId: string,
  accountId: string,
): Promise<Household> {
  const household = await getHousehold(database, householdId);
  if (!household) throw new HouseholdScopeError('That household is no longer on this device.');

  const existingOwner = await database.getFirstAsync<{ owner_account_id: string | null }>(
    'SELECT owner_account_id FROM households WHERE id = ?;',
    householdId,
  );
  if (existingOwner?.owner_account_id === accountId) return household;
  if (existingOwner?.owner_account_id) {
    throw new HouseholdScopeError('This library is already backed up to a different account.');
  }

  const alreadyOwned = await findHouseholdForAccount(database, accountId);
  if (alreadyOwned) {
    throw new HouseholdScopeError('This account already has a library on this device.');
  }

  await database.runAsync(
    'UPDATE households SET owner_account_id = ?, is_local_only = 0, updated_at = ? WHERE id = ?;',
    accountId,
    now(),
    householdId,
  );
  await setActiveHouseholdId(database, householdId);

  const updated = await getHousehold(database, householdId);
  if (!updated) throw new HouseholdScopeError('Household could not be reloaded after backup.');
  return updated;
}

/**
 * Returns a library to being device-local.
 *
 * The inverse of `backUpHouseholdToAccount`, for when the account goes away —
 * deletion, specifically. The rows are untouched; only the ownership is. A
 * family that deletes their account keeps their toys, and keeps them reachable,
 * because an unowned library is readable by whoever holds the device. Deleting
 * the library instead is Reset Pip, which is a different action behind the PIN.
 *
 * Scoped to the owner: passing an account that does not own this household
 * changes nothing and reports false, so a stale caller cannot unlink somebody
 * else's library.
 */
export async function unlinkHouseholdFromAccount(
  database: DatabaseConnection,
  householdId: string,
  accountId: string,
): Promise<boolean> {
  const result = await database.runAsync(
    'UPDATE households SET owner_account_id = NULL, is_local_only = 1, updated_at = ? WHERE id = ? AND owner_account_id = ?;',
    now(),
    householdId,
    accountId,
  );
  return result.changes === 1;
}

/**
 * Severs every trace of a remote account from this device's household.
 *
 * `unlinkHouseholdFromAccount` returns the household to local-only ownership,
 * which is the right answer when a parent signs out. Deletion needs more: the
 * remote household it pointed at no longer exists, so anything still
 * describing it is not merely stale but actively wrong.
 *
 * - `remote_id` would otherwise keep addressing a deleted remote household, and
 *   a later backup to a *different* account would try to reattach to it.
 * - `household_sync_state` is a high-water revision mark from a server that is
 *   gone. Left behind, the next backup would pull "everything above revision
 *   N" from a fresh household whose revisions start below N, and silently
 *   restore nothing.
 * - `sync_operations` and `deleted_records` are instructions addressed to that
 *   server. They describe this family's toys and what they removed, so keeping
 *   them after the account is deleted also keeps data the parent asked to be
 *   rid of.
 *
 * What is deliberately *not* removed is the library itself. A parent deleting
 * an account is ending a login, not asking for their children's toys to be
 * destroyed; that is Reset Pip, which is a separate and separately confirmed
 * action.
 *
 * One transaction, so a device can never come back up unlinked but still
 * carrying the queue, or the reverse.
 */
export async function clearRemoteLinkageAndSyncState(
  database: DatabaseConnection,
  householdId: string,
  accountId: string,
): Promise<boolean> {
  let unlinked = false;
  await database.withTransactionAsync(async () => {
    const result = await database.runAsync(
      `UPDATE households
          SET owner_account_id = NULL, remote_id = NULL, is_local_only = 1, updated_at = ?
        WHERE id = ? AND owner_account_id = ?;`,
      now(),
      householdId,
      accountId,
    );
    unlinked = result.changes === 1;
    if (!unlinked) return;
    await database.runAsync('DELETE FROM household_sync_state WHERE household_id = ?;', householdId);
    await database.runAsync('DELETE FROM sync_operations WHERE household_id = ?;', householdId);
    await database.runAsync('DELETE FROM deleted_records WHERE household_id = ?;', householdId);
  });
  return unlinked;
}

/**
 * Whether an account may read a household.
 *
 * The predicate the repositories enforce. Device-local households are readable
 * by whoever is holding the phone, which is what makes account-free use work;
 * owned households are readable only by their owner.
 */
export function canAccountReadHousehold(household: Household, accountId: AccountId): boolean {
  if (!household.ownerAccountId) return true;
  return household.ownerAccountId === accountId;
}
