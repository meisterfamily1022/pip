import type { DatabaseConnection } from '@/database/types';
import { isSupabaseConfigured, supabase } from '@/lib/supabase';
import { clearRemoteLinkageAndSyncState, getActiveHouseholdId } from '@/features/household/household-scope';
import { verifyParentPin } from '@/features/child/parent-access';
import { pinStorage, type PinStorage } from '@/services/pin-storage';

/**
 * Deleting a Pip account.
 *
 * Removing a Supabase user requires the service-role key, which must never be
 * in a mobile bundle. Real deletion therefore has to run server-side, in an
 * Edge Function that authenticates the caller and deletes that caller's own
 * user and remote rows. This module is the app's half of that contract: the
 * boundary, the local consequences, and — while no function is deployed — an
 * honest account of the fact.
 *
 * Availability is declared rather than probed. The app cannot ask whether a
 * function exists without calling it, and offering a Delete button that might
 * turn out to be a 404 is worse than offering none: it tells a parent their
 * account is gone when it is not. `EXPO_PUBLIC_PIP_ACCOUNT_DELETION_READY` is
 * set by whoever deploys the function, so the button appears only where it can
 * actually be honoured.
 */

/** The Edge Function expected to exist. Deletes the *calling* user, nothing else. */
export const ACCOUNT_DELETION_FUNCTION = 'delete-account';

export type DeletionAvailability =
  /** A deployed function is declared; deletion can be attempted. */
  | 'available'
  /** No function is deployed. Pip must say so rather than pretend. */
  | 'not-configured';

export class AccountDeletionError extends Error {}

export type AccountDeletionGateway = {
  readonly availability: DeletionAvailability;
  /** Deletes the authenticated caller's account and its remote data. */
  deleteAuthenticatedAccount(): Promise<void>;
};

export function readDeletionAvailability(
  flag: string | undefined = process.env.EXPO_PUBLIC_PIP_ACCOUNT_DELETION_READY,
  supabaseConfigured: boolean = isSupabaseConfigured,
): DeletionAvailability {
  return flag === '1' && supabaseConfigured ? 'available' : 'not-configured';
}

export const supabaseAccountDeletionGateway: AccountDeletionGateway = {
  get availability() {
    return readDeletionAvailability();
  },
  async deleteAuthenticatedAccount() {
    const { error } = await supabase.functions.invoke(ACCOUNT_DELETION_FUNCTION, { method: 'POST' });
    if (error) {
      throw new AccountDeletionError(
        'Pip could not delete your account. Nothing has been changed. Check your connection and try again.',
      );
    }
  },
};

/**
 * What deletion does to the library on this device.
 *
 * It does not delete it. A parent deleting an account is ending a login, not
 * asking for their toy inventory to be destroyed, and conflating the two would
 * make an irreversible action quietly more irreversible than it reads.
 *
 * The library is unlinked instead: it reverts to being a device-local library,
 * exactly as it was before it was ever backed up, and stays usable with no
 * account at all. Clearing the device is a separate, deliberately separate,
 * PIN-protected action — Reset Pip.
 */
export const DELETION_CONSEQUENCES = [
  'Your Pip account and the email address attached to it are deleted.',
  'Any data Pip holds for that account on its servers is deleted.',
  'Your toys, photos, children and rooms stay on this iPhone. Deleting the account does not remove them.',
  'You are signed out. This cannot be undone.',
] as const;

/** Copy for the state where no deletion backend is deployed. Truthful, not hedged. */
export const DELETION_UNAVAILABLE_NOTE =
  'Deleting your account from inside Pip is not available in this build. No account-deletion service is configured, and Pip will not show a button that cannot actually delete anything.';

export type DeleteAccountResult = { householdUnlinked: boolean };

/**
 * Deletes the account, then settles this device.
 *
 * Ordering is deliberate. The remote deletion happens first and everything
 * local is contingent on it succeeding: if the server call fails there is
 * nothing to undo, and the parent is told plainly that nothing changed. Only
 * once the account is genuinely gone is the local library unlinked and the
 * session cleared — the reverse order would leave a device unlinked from an
 * account that still exists.
 */
export async function deleteAccountAndSettleDevice(
  database: DatabaseConnection,
  accountId: string,
  gateway: AccountDeletionGateway,
  signOut: () => Promise<void>,
): Promise<DeleteAccountResult> {
  if (gateway.availability !== 'available') {
    throw new AccountDeletionError(DELETION_UNAVAILABLE_NOTE);
  }

  await gateway.deleteAuthenticatedAccount();

  const householdId = await getActiveHouseholdId(database);
  // Not just unlinked: everything that described the now-deleted remote
  // household goes too, so nothing on this device still points at it or holds
  // work queued for it.
  const householdUnlinked = await clearRemoteLinkageAndSyncState(database, householdId, accountId);

  // Last: the session going away re-scopes the device, and it must do so with
  // the household already unlinked or the library would be hidden from the very
  // person who just deleted the only account that could see it.
  await signOut();

  return { householdUnlinked };
}

/**
 * The parent-facing entry point: PIN first, then delete.
 *
 * The PIN is checked before the server is contacted, so a wrong one costs
 * nothing and can say so honestly — "nothing was deleted" is only a safe thing
 * to tell somebody if it is true at the moment you say it. This is the same
 * gate Reset Pip uses, for the same reason: an irreversible action should take
 * more than a tap by whoever is holding an unlocked phone.
 */
export async function deleteAccountWithPin(
  database: DatabaseConnection,
  accountId: string,
  enteredPin: string,
  gateway: AccountDeletionGateway,
  signOut: () => Promise<void>,
  pins: PinStorage = pinStorage,
): Promise<DeleteAccountResult> {
  if (gateway.availability !== 'available') throw new AccountDeletionError(DELETION_UNAVAILABLE_NOTE);
  if (!(await verifyParentPin(pins, enteredPin))) {
    throw new AccountDeletionError('That parent PIN does not match. Your account was not deleted.');
  }
  return deleteAccountAndSettleDevice(database, accountId, gateway, signOut);
}
