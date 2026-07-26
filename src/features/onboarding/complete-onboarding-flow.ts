import type { DatabaseConnection } from '@/database/types';
import type { PinStorage } from '@/services/pin-storage';
import { pinStorage } from '@/services/pin-storage';
import { completeOnboarding, type CompleteOnboardingInput } from './complete-onboarding';

export type CompleteOnboardingFlowInput = CompleteOnboardingInput & { pin: string };

export async function savePinThenCompleteOnboarding(
  input: CompleteOnboardingFlowInput,
  storage: PinStorage,
  saveOnboarding: () => Promise<void>,
): Promise<void> {
  const previousPin = await storage.getPin();
  await storage.savePin(input.pin);
  try {
    await saveOnboarding();
  } catch (error: unknown) {
    if (previousPin === null) {
      await storage.deletePin();
    } else {
      await storage.savePin(previousPin);
    }
    throw error;
  }
}

export async function completeOnboardingFlow(
  database: DatabaseConnection,
  input: CompleteOnboardingFlowInput,
): Promise<void> {
  await savePinThenCompleteOnboarding(input, pinStorage, () => completeOnboarding(database, input));
}
