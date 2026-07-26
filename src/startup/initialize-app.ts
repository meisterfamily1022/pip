import { initializeDatabase } from '@/database/client';
import { getSettings } from '@/repositories/settings-repository';
import { pinStorage } from '@/services/pin-storage';
import { getStartupDestination, type StartupDestination } from './startup-routing';

export async function initializeApp(): Promise<StartupDestination> {
  const database = await initializeDatabase();
  const settings = await getSettings(database);
  const pin = settings.onboardingCompleted ? await pinStorage.getPin() : null;
  return getStartupDestination(settings, pin !== null);
}
