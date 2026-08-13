import { initializeDatabase } from '@/database/client';
import { getSettings } from '@/repositories/settings-repository';
import { pinStorage } from '@/services/pin-storage';
import type { OnboardingState } from './startup-routing';
import { onboardingProgressStorage } from '@/services/onboarding-progress-storage';

export async function initializeApp(): Promise<OnboardingState> {
  const database = await initializeDatabase();
  const settings = await getSettings(database);
  const [pin, child, location, guestOnboardingStarted] = await Promise.all([
    pinStorage.getPin(),
    database.getFirstAsync<{ id: number }>('SELECT id FROM child_profiles WHERE hidden_at IS NULL LIMIT 1;'),
    database.getFirstAsync<{ id: number }>('SELECT s.id FROM storage_spots s JOIN rooms r ON r.id = s.room_id LIMIT 1;'),
    onboardingProgressStorage.getStarted(),
  ]);
  return { settings, hasPin: pin !== null, hasChild: child !== null, hasLocation: location !== null, guestOnboardingStarted };
}
