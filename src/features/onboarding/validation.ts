import type { ChoiceLimit } from '@/domain/models';

export const DEFAULT_CHOICE_LIMIT: ChoiceLimit = 3;
export const DEFAULT_CLEANUP_REQUIRED = true;

export function validatePin(pin: string): string | null {
  return /^\d{4}$/.test(pin) ? null : 'Enter a four-digit numeric PIN.';
}

export function validatePinConfirmation(pin: string, confirmation: string): string | null {
  const pinError = validatePin(pin);
  if (pinError) return pinError;
  return pin === confirmation ? null : 'The PINs do not match.';
}

export function validateRequiredName(value: string, label: string): string | null {
  return value.trim().length > 0 ? null : `${label} is required.`;
}
