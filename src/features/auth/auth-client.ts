import type { User } from '@supabase/supabase-js';

import { supabase } from '@/lib/supabase';
import { clearSession, setAuthenticatedSession, type AuthenticatedAccount, type SessionRestorer } from './session-state';
import { pendingVerification } from './sign-up-form';

export class AuthRequestError extends Error {
  constructor(readonly code: string, message: string) {
    super(message);
    this.name = 'AuthRequestError';
  }
}

export function authError(error: { message: string; code?: string; status?: number; name?: string }): AuthRequestError {
  const message = error.message.toLowerCase();
  const code = error.code?.toLowerCase();
  if (error.status === 429 || code === 'over_email_send_rate_limit' || code === 'over_request_rate_limit' || code === 'over_sms_send_rate_limit') {
    return new AuthRequestError('RATE_LIMITED', 'Please wait a moment before requesting or checking another code.');
  }
  // AuthRetryableFetchError also represents HTTP 5xx responses. Only a zero or
  // absent status means no response reached the client; treating every
  // retryable response as offline hid real email-provider failures in Release.
  const hasNoResponse = error.status === 0 || error.status == null;
  if (hasNoResponse && ['dns', 'cannot find host', 'name not resolved'].some((value) => message.includes(value))) {
    return new AuthRequestError('DNS_ERROR', 'Pip could not find the sign-in service. Check your connection and try again.');
  }
  if (hasNoResponse && ['tls', 'ssl', 'certificate', 'secure connection'].some((value) => message.includes(value))) {
    return new AuthRequestError('TLS_ERROR', 'Pip could not establish a secure connection to the sign-in service. Try again shortly.');
  }
  if (hasNoResponse && ['timed out', 'timeout', 'cannot connect', 'connection refused', 'connection lost'].some((value) => message.includes(value))) {
    return new AuthRequestError('CONNECTION_ERROR', 'Pip could not connect to the sign-in service. Check your connection and try again.');
  }
  if (hasNoResponse && (error.name === 'AuthRetryableFetchError' || ['failed to fetch', 'network request failed', 'network error', 'offline'].some((value) => message.includes(value)))) {
    return new AuthRequestError('NETWORK_ERROR', 'You appear to be offline. Check your connection and try again.');
  }
  if (message.includes('already') || message.includes('used')) return new AuthRequestError('OTP_USED', 'That code has already been used. Send a new code and try again.');
  // Supabase deliberately uses otp_expired for the non-distinguishing response
  // "Token has expired or is invalid". Never turn that response into the
  // definite (and often false) claim that a freshly entered code expired.
  if (message.includes('expired or') || message.includes('invalid or expired')) {
    return new AuthRequestError('OTP_INVALID_OR_EXPIRED', 'That code is incorrect, expired, or has already been used. Check the newest code or send another.');
  }
  if (code === 'otp_expired' || message.includes('expired')) return new AuthRequestError('OTP_EXPIRED', 'That code has expired. Send a new code and try again.');
  if (code === 'otp_invalid' || message.includes('invalid') || message.includes('token') || message.includes('otp') || message.includes('code')) {
    return new AuthRequestError('OTP_INVALID', 'That code is incorrect. Check the newest code and try again.');
  }
  return new AuthRequestError('SERVICE_ERROR', 'The sign-in service could not complete the request. Try again shortly.');
}

function toAccount(user: User): AuthenticatedAccount {
  return { accountId: user.id, email: user.email ?? '', emailVerified: Boolean(user.email_confirmed_at) };
}

/** Sends the same passwordless email OTP for both new and returning parents. */
export async function sendEmailOtp(email: string): Promise<void> {
  const { error } = await supabase.auth.signInWithOtp({ email, options: { shouldCreateUser: true } });
  if (error) throw authError(error);
}

async function requestFreshEmailOtp(email: string): Promise<void> {
  const normalizedEmail = email.trim();
  // The old address is no longer a resumable verification attempt as soon as
  // the user asks for a replacement. Persist only after Supabase accepts the
  // fresh request, so a failed send cannot resurrect stale local context.
  await pendingVerification.clear();
  await sendEmailOtp(normalizedEmail);
  await pendingVerification.set(normalizedEmail);
}

export const signUp = async (input: { email: string }): Promise<void> => requestFreshEmailOtp(input.email);
export const signIn = async (email: string, _unusedPassword?: string): Promise<void> => requestFreshEmailOtp(email);
export const resendVerification = async (email: string): Promise<void> => requestFreshEmailOtp(email);

/** Verifies Supabase's six-digit email OTP and publishes the resulting session. */
export async function verifyEmail(email: string, code: string): Promise<AuthenticatedAccount> {
  const { data, error } = await supabase.auth.verifyOtp({ email, token: code, type: 'email' });
  if (error) throw authError(error);
  if (!data.user) throw new AuthRequestError('AUTH_ERROR', 'We could not complete sign-in. Try again shortly.');
  const account = toAccount(data.user);
  setAuthenticatedSession(account);
  return account;
}

/** Restores the encrypted Supabase session on launch. */
export function createSessionRestorer(): SessionRestorer {
  return async () => {
    const { data, error } = await supabase.auth.getSession();
    if (error) throw error;
    return data.session?.user ? toAccount(data.session.user) : null;
  };
}

export async function signOut(): Promise<void> {
  const { error } = await supabase.auth.signOut();
  clearSession();
  if (error) throw authError(error);
}

// These legacy web-only account-management routes are intentionally not backed
// by the retired local auth server. Profiles are identity-only in this change.
const unsupported = (): never => {
  throw new AuthRequestError('UNSUPPORTED', 'This account action is not available yet.');
};
export async function renameHousehold(_householdId: string, _name: string): Promise<void> { unsupported(); }
export async function reauthenticate(_password: string): Promise<void> { unsupported(); }
export async function deleteAccount(): Promise<void> { unsupported(); }
export async function requestPasswordReset(email: string): Promise<void> {
  const { error } = await supabase.auth.resetPasswordForEmail(email);
  if (error) throw authError(error);
}
