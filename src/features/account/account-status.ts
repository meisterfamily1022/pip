import type { DatabaseConnection } from '@/database/types';
import type { SessionState } from '@/features/auth/session-state';
import { getActiveHouseholdId } from '@/features/household/household-scope';
import { getHousehold } from '@/repositories/households-repository';

/**
 * What Pip can truthfully say about the account on this device.
 *
 * Kept apart from the screen because the honest answer depends on two things
 * that live in different places — the session, and who owns the household on
 * screen — and because the sign-out consequence has to be derived rather than
 * written as fixed copy. Telling a parent their library "stays on this device"
 * is true in both cases, but it is materially incomplete when the library is
 * linked to the account they are signing out of.
 */
export type AccountStatus = {
  signedIn: boolean;
  email: string | null;
  /** The library on screen belongs to the signed-in account. */
  householdLinked: boolean;
  householdName: string;
};

export async function loadAccountStatus(
  database: DatabaseConnection,
  session: SessionState,
): Promise<AccountStatus> {
  const signedIn = session.status === 'signedIn' && session.account !== null;
  const householdId = await getActiveHouseholdId(database);
  const household = await getHousehold(database, householdId);
  const owner = household?.ownerAccountId ?? null;
  return {
    signedIn,
    email: signedIn ? (session.account?.email ?? null) : null,
    householdLinked: signedIn && owner !== null && owner === session.account?.accountId,
    householdName: household?.name ?? 'This library',
  };
}

/**
 * What an account actually does today.
 *
 * Deliberately not aspirational. Authentication exists; backup and restore do
 * not, and no wording here may imply otherwise until they are proven to work.
 */
export const ACCOUNT_CAPABILITY_NOTE =
  'An account signs you in. Your library stays on this device — backup and use on another device are not available yet.';

/** Precisely what signing out will and will not do, for this device's state. */
export function signOutConsequence(status: AccountStatus): string {
  if (!status.householdLinked) {
    return 'Your library stays on this device and will still be here. Nothing is deleted.';
  }
  return 'This library is linked to your account, so it will be hidden until you sign in again. It stays on this device and nothing is deleted.';
}

/** What a parent is agreeing to when they switch to a different account. */
export function switchAccountConsequence(status: AccountStatus): string {
  if (!status.householdLinked) {
    return 'You will be signed out, then asked to sign in as someone else. This library is not linked to an account, so it stays available on this device.';
  }
  return 'You will be signed out, then asked to sign in as someone else. This library is linked to your account and will be hidden from them. It stays on this device for when you sign back in.';
}
