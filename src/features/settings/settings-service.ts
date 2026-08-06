import type { ChoiceLimit } from '@/domain/models';
import type { DatabaseConnection } from '@/database/types';
import { getSettings, updateSettings } from '@/repositories/settings-repository';
import { createChildProfile, listChildProfiles, updateChildProfile } from '@/repositories/child-profiles-repository';
import type { PinStorage } from '@/services/pin-storage';
import { validateChildNickname, validatePin, validatePinConfirmation } from '@/features/onboarding/validation';

export class SettingsValidationError extends Error {}

export type ParentSettingsInput = {
  childNickname: string;
  choiceLimit: number;
  cleanupRequired: boolean;
};

function parseChoiceLimit(value: number): ChoiceLimit {
  if (value === 1 || value === 3 || value === 5) return value;
  throw new SettingsValidationError('Choice limit must be 1, 3, or 5.');
}

export async function saveParentSettings(database: DatabaseConnection, input: ParentSettingsInput) {
  const childNickname = input.childNickname.trim();
  const nicknameError = validateChildNickname(childNickname);
  if (nicknameError) throw new SettingsValidationError(nicknameError);
  const choiceLimit = parseChoiceLimit(input.choiceLimit);
  const settings = await getSettings(database);
  if (!settings.activeChildId) throw new SettingsValidationError('Choose a child profile first.');
  await updateChildProfile(database, settings.activeChildId, childNickname);
  return updateSettings(database, { childNickname, choiceLimit, cleanupRequired: input.cleanupRequired });
}

export async function loadParentSettings(database: DatabaseConnection) {
  return getSettings(database);
}

export async function addChildProfile(database: DatabaseConnection, name: string) {
  const nicknameError = validateChildNickname(name.trim());
  if (nicknameError) throw new SettingsValidationError(nicknameError);
  return createChildProfile(database, name);
}

export { listChildProfiles };

export type ChangePinInput = {
  currentPin: string;
  newPin: string;
  confirmation: string;
};

export async function changeParentPin(storage: PinStorage, input: ChangePinInput): Promise<void> {
  const existingPin = await storage.getPin();
  if (existingPin === null || existingPin !== input.currentPin) throw new SettingsValidationError('Current PIN is not correct.');
  const pinError = validatePin(input.newPin);
  if (pinError) throw new SettingsValidationError(pinError);
  const confirmationError = validatePinConfirmation(input.newPin, input.confirmation);
  if (confirmationError) throw new SettingsValidationError(confirmationError);
  try {
    await storage.savePin(input.newPin);
  } catch (error: unknown) {
    await storage.savePin(existingPin);
    throw error;
  }
}
