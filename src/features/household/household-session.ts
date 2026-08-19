import { initializeDatabase } from '@/database/client';
import { getSessionSnapshot, subscribeSession, type SessionState } from '@/features/auth/session-state';

import { activateHouseholdForAccount, type AccountId } from './household-scope';

/**
 * Keeps the household on screen in step with who is signed in.
 *
 * The ownership rules live in `household-scope`; this is the part that runs
 * them at the right moments. It watches the session store rather than being
 * called from each screen, because the transitions that matter — sign-in,
 * sign-out, switch, expiry, restore-on-launch — are spread across routes that
 * should not each have to remember to re-scope the library. One of them
 * forgetting is exactly how the original leak would come back.
 */

/** `expired` is treated as signed out: a rejected session may not read owned data. */
function accountFor(state: SessionState): AccountId {
  return state.status === 'signedIn' ? (state.account?.accountId ?? null) : null;
}

// Transitions are serialised. Sign-out immediately followed by sign-in would
// otherwise race two activations, and the loser would leave the device pointing
// at the wrong household.
let queue: Promise<unknown> = Promise.resolve();

export function syncHouseholdToSession(state: SessionState = getSessionSnapshot()): Promise<string> {
  const next = queue.then(async () => {
    const database = await initializeDatabase();
    return activateHouseholdForAccount(database, accountFor(state));
  });
  // Keep the chain alive even if one activation fails, so a transient database
  // error cannot wedge every later sign-in.
  queue = next.catch(() => undefined);
  return next;
}

/**
 * Starts watching. Returns an unsubscribe, and runs once immediately so a
 * launch that restores a session lands on the right household before the first
 * screen reads anything.
 */
export function startHouseholdSessionSync(): () => void {
  void syncHouseholdToSession();
  return subscribeSession(() => {
    void syncHouseholdToSession();
  });
}
