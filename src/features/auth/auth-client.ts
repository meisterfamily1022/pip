import type { User } from '@supabase/supabase-js';
import { isDevice } from 'expo-device';
import { Platform } from 'react-native';

import { supabase } from '@/lib/supabase';
import { clearSession, setAuthenticatedSession, type AuthenticatedAccount, type SessionRestorer } from './session-state';

export class AuthRequestError extends Error {
  constructor(readonly code: string, message: string) {
    super(message);
    this.name = 'AuthRequestError';
  }
}

function authError(error: { message: string; code?: string; status?: number }): AuthRequestError {
  const message = error.message.toLowerCase();
  if (message.includes('expired')) return new AuthRequestError('OTP_EXPIRED', 'That code has expired. Send a new code and try again.');
  if (message.includes('already') || message.includes('used')) return new AuthRequestError('OTP_USED', 'That code has already been used. Send a new code and try again.');
  if (message.includes('token') || message.includes('otp') || message.includes('code')) return new AuthRequestError('OTP_INVALID', 'That code is not valid. Check it and try again, or send a new code.');
  if (error.status === 429) return new AuthRequestError('RATE_LIMITED', 'Please wait a moment before requesting another code.');
  return new AuthRequestError(error.code ?? 'AUTH_ERROR', 'We could not complete sign-in. Try again shortly.');
}

function toAccount(user: User): AuthenticatedAccount {
  return { accountId: user.id, email: user.email ?? '', emailVerified: Boolean(user.email_confirmed_at) };
}

export function shouldBypassSimulatorAuth(input: {
  enabled: boolean;
  platform: string;
  isPhysicalDevice: boolean;
}): boolean {
  return input.enabled && input.platform === 'ios' && !input.isPhysicalDevice;
}

/** Sends the same passwordless email OTP for both new and returning parents. */
export async function sendEmailOtp(email: string): Promise<void> {
  // Release-mode UI automation needs a deterministic success path without
  // weakening a device build. Expo only inlines this opt-in at bundle time,
  // and a physical iPhone can never take the bypass even if misconfigured.
  if (shouldBypassSimulatorAuth({
    enabled: process.env.EXPO_PUBLIC_PIP_SIMULATOR_AUTH === 'true',
    platform: Platform.OS,
    isPhysicalDevice: isDevice,
  })) return;
  const { error } = await supabase.auth.signInWithOtp({ email, options: { shouldCreateUser: true } });
  if (error) throw authError(error);
}

export const signUp = async (input: { email: string }): Promise<void> => sendEmailOtp(input.email);
export const signIn = async (email: string, _unusedPassword?: string): Promise<void> => sendEmailOtp(email);
export const resendVerification = async (email: string): Promise<void> => sendEmailOtp(email);

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
