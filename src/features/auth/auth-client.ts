import { authSessionStorage, type AuthSessionStorage } from '@/services/auth-session-storage';
import {
  clearSession,
  setAuthenticatedSession,
  setOffline,
  type AuthenticatedAccount,
  type SessionRestorer,
} from './session-state';

/**
 * Client side of the account API.
 *
 * Pip is local-first: every failure here degrades to "signed out" rather than
 * blocking the app, because the product works fully without an account.
 */

const AUTH_BASE = '/v1/auth';

type AuthErrorBody = { error?: { code?: string; message?: string } };

export class AuthRequestError extends Error {
  constructor(
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'AuthRequestError';
  }
}

async function request<T>(
  path: string,
  init: RequestInit & { token?: string } = {},
): Promise<T | null> {
  const { token, ...rest } = init;
  const url = path.startsWith('/household') ? `/v1${path}` : `${AUTH_BASE}${path}`;
  const response = await fetch(url, {
    ...rest,
    headers: {
      'content-type': 'application/json',
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      ...rest.headers,
    },
  });

  if (response.status === 204 || response.status === 202) return null;

  const body: unknown = await response.json().catch(() => ({}));
  if (!response.ok) {
    const parsed = body as AuthErrorBody;
    throw new AuthRequestError(parsed.error?.code ?? 'INTERNAL_ERROR', parsed.error?.message ?? 'Something went wrong.');
  }
  return body as T;
}

type SessionResponse = {
  token: string;
  context: AuthenticatedAccount & { sessionId: string };
};

type ContextResponse = AuthenticatedAccount & { sessionId: string };

const toAccount = (context: ContextResponse): AuthenticatedAccount => ({
  accountId: context.accountId,
  householdId: context.householdId,
  firstName: context.firstName,
  email: context.email,
  emailVerified: context.emailVerified,
});

/**
 * Restores a stored session at launch.
 *
 * A rejected token is discarded so the device does not retry it forever. A
 * network failure keeps the token, because being offline is not the same as
 * being signed out, and the parent should not have to sign in again when the
 * connection returns.
 */
export function createSessionRestorer(storage: AuthSessionStorage = authSessionStorage): SessionRestorer {
  return async () => {
    const token = await storage.read();
    if (!token) return null;

    try {
      const context = await request<ContextResponse>('/session', { method: 'GET', token });
      return context ? toAccount(context) : null;
    } catch (error: unknown) {
      if (error instanceof AuthRequestError) {
        // The server rejected it; it will never work again.
        await storage.clear();
        return null;
      }
      setOffline(true);
      throw error;
    }
  };
}

async function adoptSession(result: SessionResponse, storage: AuthSessionStorage): Promise<AuthenticatedAccount> {
  await storage.save(result.token);
  const account = toAccount(result.context);
  setAuthenticatedSession(account);
  return account;
}

export async function signUp(
  input: { email: string; firstName: string; password: string; householdName?: string; acceptedTerms: boolean },
): Promise<void> {
  await request('/sign-up', { method: 'POST', body: JSON.stringify(input) });
}

export async function verifyEmail(
  email: string,
  code: string,
  storage: AuthSessionStorage = authSessionStorage,
): Promise<AuthenticatedAccount> {
  const result = await request<SessionResponse>('/verify', { method: 'POST', body: JSON.stringify({ email, code }) });
  if (!result) throw new AuthRequestError('INTERNAL_ERROR', 'Something went wrong.');
  return adoptSession(result, storage);
}

export async function resendVerification(email: string): Promise<void> {
  await request('/verify', { method: 'PUT', body: JSON.stringify({ email }) });
}

export async function signIn(
  email: string,
  password: string,
  storage: AuthSessionStorage = authSessionStorage,
): Promise<AuthenticatedAccount> {
  const result = await request<SessionResponse>('/sign-in', { method: 'POST', body: JSON.stringify({ email, password }) });
  if (!result) throw new AuthRequestError('INTERNAL_ERROR', 'Something went wrong.');
  return adoptSession(result, storage);
}

/**
 * Ends the server session and forgets the token.
 *
 * Local data is deliberately untouched: signing out must never look like a way
 * to lose a library that has not synced.
 */
export async function signOut(storage: AuthSessionStorage = authSessionStorage): Promise<void> {
  const token = await storage.read();
  try {
    if (token) await request('/session', { method: 'DELETE', token });
  } catch {
    // Even if the server cannot be reached, drop the local token.
  }
  await storage.clear();
  clearSession();
}

/**
 * Names the household after verification.
 *
 * Renaming is idempotent, so a retry after a dropped connection settles on the
 * same value rather than creating a second household.
 */
export async function renameHousehold(
  householdId: string,
  name: string,
  storage: AuthSessionStorage = authSessionStorage,
): Promise<void> {
  const token = await storage.read();
  if (!token) throw new AuthRequestError('SESSION_INVALID', 'Sign in to continue.');
  await request('/household', {
    method: 'PATCH',
    token,
    body: JSON.stringify({ householdId, name }),
  });
}

export async function requestPasswordReset(email: string): Promise<void> {
  await request('/password-reset', { method: 'POST', body: JSON.stringify({ email }) });
}

export async function resetPassword(token: string, password: string): Promise<void> {
  await request('/password-reset', { method: 'PUT', body: JSON.stringify({ token, password }) });
}
