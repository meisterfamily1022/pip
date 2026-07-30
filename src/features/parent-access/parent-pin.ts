import { pinStorage, type PinStorage } from '@/services/pin-storage';
import { validatePin } from '@/features/onboarding/validation';

/**
 * Parent PIN checks for the grown-up gate and the cleanup override.
 *
 * The PIN lives in the secure store, never in SQLite, so it is read on demand
 * rather than held in app state.
 */

export async function verifyParentPin(candidate: string, storage: PinStorage = pinStorage): Promise<boolean> {
  const stored = await storage.getPin();
  if (stored === null) return false;
  return stored === candidate;
}

export async function changeParentPin(
  currentPin: string,
  nextPin: string,
  confirmation: string,
  storage: PinStorage = pinStorage,
): Promise<void> {
  if (!(await verifyParentPin(currentPin, storage))) throw new Error('Your current PIN is not correct.');
  const formatError = validatePin(nextPin);
  if (formatError) throw new Error(formatError);
  if (nextPin !== confirmation) throw new Error('The new PINs do not match.');
  await storage.savePin(nextPin);
}
