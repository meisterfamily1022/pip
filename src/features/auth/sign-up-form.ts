import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

import { pipBrand } from '@/brand/pip-brand';
import { MINIMUM_PASSWORD_LENGTH } from '@/domain/password-policy';

/**
 * Sign-up form rules and the small amount of state that has to outlive the
 * screen so an interrupted sign-up resumes at the right step.
 *
 * The rules live here rather than in the component so they can be tested
 * directly and so the client and server agree on what is acceptable.
 */

export type SignUpFields = {
  firstName: string;
  email: string;
  password: string;
  acceptedTerms: boolean;
};

export type SignUpFieldErrors = Partial<Record<'firstName' | 'email' | 'password' | 'acceptedTerms', string>>;

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const passwordRequirementHint = `At least ${MINIMUM_PASSWORD_LENGTH} characters.`;

export function validateSignUp(fields: SignUpFields): SignUpFieldErrors {
  const errors: SignUpFieldErrors = {};
  if (!fields.firstName.trim()) errors.firstName = 'Enter your first name.';
  if (!EMAIL_PATTERN.test(fields.email.trim())) errors.email = 'Enter an email address we can reach you at.';
  if (fields.password.length < MINIMUM_PASSWORD_LENGTH) {
    errors.password = `Use at least ${MINIMUM_PASSWORD_LENGTH} characters.`;
  }
  // Consent is never assumed, so an unchecked box is a validation failure
  // rather than a silently accepted default.
  if (!fields.acceptedTerms) errors.acceptedTerms = 'Accept the terms and privacy notice to continue.';
  return errors;
}

export function hasErrors(errors: SignUpFieldErrors): boolean {
  return Object.keys(errors).length > 0;
}

/** Ordered for the error summary, so it reads in the same order as the form. */
export function errorSummary(errors: SignUpFieldErrors): string[] {
  return (['firstName', 'email', 'password', 'acceptedTerms'] as const)
    .map((field) => errors[field])
    .filter((message): message is string => Boolean(message));
}

/* ------------------------------------------------------------- family space */

/**
 * Suggested household names.
 *
 * The first is personalised; the rest are neutral, because not every family
 * wants the household named after one parent.
 */
export function householdNameSuggestions(firstName: string): string[] {
  const trimmed = firstName.trim();
  const personal = trimmed ? `${trimmed}'s ${pipBrand.name}` : `Our ${pipBrand.name}`;
  return [personal, `Our ${pipBrand.name}`, 'The Playroom', 'Home'];
}

export function validateHouseholdName(name: string): string | null {
  const trimmed = name.trim();
  if (!trimmed) return 'Give your Pip a name.';
  if (trimmed.length > 60) return 'Use a shorter name.';
  return null;
}

/* ----------------------------------------------------------------- resuming */

const PENDING_KEY = 'pip.pending-verification-email';

let inMemoryPending: string | null = null;

/**
 * The address awaiting confirmation.
 *
 * Persisted so closing the app mid-sign-up returns the parent to the code
 * screen rather than an empty form. It is only an address, never a credential,
 * but it still goes to secure storage on device rather than plain storage.
 */
export const pendingVerification = {
  async set(email: string): Promise<void> {
    if (Platform.OS === 'web') {
      inMemoryPending = email;
      return;
    }
    await SecureStore.setItemAsync(PENDING_KEY, email);
  },

  async get(): Promise<string | null> {
    if (Platform.OS === 'web') return inMemoryPending;
    return SecureStore.getItemAsync(PENDING_KEY);
  },

  async clear(): Promise<void> {
    if (Platform.OS === 'web') {
      inMemoryPending = null;
      return;
    }
    await SecureStore.deleteItemAsync(PENDING_KEY);
  },
};

export function resetPendingVerificationForTests(): void {
  inMemoryPending = null;
}
