import type { SessionStatus } from '@/startup/route-guards';

/**
 * Client-side parent session state.
 *
 * This is the single source of truth the route guards read. It is an external
 * store in the same shape as `route-access`, so `useSyncExternalStore` can
 * subscribe without a provider.
 *
 * Household data is available only after a parent has authenticated.
 */

export type AuthenticatedAccount = {
  accountId: string;
  /** Legacy local-only UI fields; Supabase profiles currently store identity only. */
  householdId?: string;
  firstName?: string;
  email: string;
  emailVerified: boolean;
};

export type SessionState = {
  status: SessionStatus;
  account: AuthenticatedAccount | null;
  /** Set when a session-bearing request could not reach the server. */
  offline: boolean;
};

/** Restores a stored session on launch. Returns null when there is none. */
export type SessionRestorer = () => Promise<AuthenticatedAccount | null>;

const listeners = new Set<() => void>();

let state: SessionState = { status: 'restoring', account: null, offline: false };
let restoration: Promise<void> | null = null;

function publish(update: Partial<SessionState>): void {
  state = { ...state, ...update };
  listeners.forEach((listener) => listener());
}

export function subscribeSession(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getSessionSnapshot(): SessionState {
  return state;
}

/**
 * Restores once per app start. A restore failure resolves to `signedOut` with
 * `offline` set rather than throwing: losing the network must never strand the
 * parent on a blank screen when the whole product works locally.
 */
export function restoreSession(restorer: SessionRestorer): Promise<void> {
  if (!restoration) {
    publish({ status: 'restoring', offline: false });
    restoration = restorer()
      .then((account) => {
        publish(account ? { status: 'signedIn', account, offline: false } : { status: 'signedOut', account: null, offline: false });
      })
      .catch(() => {
        publish({ status: 'signedOut', account: null, offline: true });
      });
  }
  return restoration;
}

export function setAuthenticatedSession(account: AuthenticatedAccount): void {
  publish({ status: 'signedIn', account, offline: false });
}

/** The stored session was rejected. Local data is untouched. */
export function markSessionExpired(): void {
  publish({ status: 'expired', account: null });
}

export function clearSession(): void {
  publish({ status: 'signedOut', account: null, offline: false });
}

export function setOffline(offline: boolean): void {
  publish({ offline });
}

/** Test seam: forget the once-per-start restoration guard. */
export function resetSessionStateForTests(): void {
  restoration = null;
  state = { status: 'restoring', account: null, offline: false };
}
