import { didCreateDatabaseThisLaunch, initializeDatabase } from '@/database/client';
import { getSettings } from '@/repositories/settings-repository';
import { pinStorage } from '@/services/pin-storage';
import type { OnboardingState } from './startup-routing';
import { onboardingProgressStorage } from '@/services/onboarding-progress-storage';

/**
 * Discards keychain entries belonging to an installation that is gone.
 *
 * Deleting an iOS app removes its files but not its keychain items, so a parent
 * who reinstalls Pip arrives with a PIN and an onboarding-started flag from the
 * old install and an empty database. Startup routing reads `hasPin` and jumps
 * straight to "Add a child": the welcome screen never appears, the account
 * options are never offered, and Parent Mode ends up guarded by a PIN the
 * parent set for data that no longer exists.
 *
 * Only ever runs when this launch created the database, which is the one signal
 * that cannot be faked by leftover keychain state. A parent midway through
 * setup on an existing install has a database already and is untouched.
 */
async function discardKeychainFromPreviousInstall(): Promise<void> {
  await Promise.all([pinStorage.deletePin(), onboardingProgressStorage.clear()]);
}

export async function initializeApp(): Promise<OnboardingState> {
  const database = await initializeDatabase();
  if (didCreateDatabaseThisLaunch()) await discardKeychainFromPreviousInstall();
  const settings = await getSettings(database);
  const [pin, child, location, guestOnboardingStarted] = await Promise.all([
    pinStorage.getPin(),
    database.getFirstAsync<{ id: number }>('SELECT id FROM child_profiles WHERE hidden_at IS NULL LIMIT 1;'),
    database.getFirstAsync<{ id: number }>('SELECT s.id FROM storage_spots s JOIN rooms r ON r.id = s.room_id LIMIT 1;'),
    onboardingProgressStorage.getStarted(),
  ]);
  return { settings, hasPin: pin !== null, hasChild: child !== null, hasLocation: location !== null, guestOnboardingStarted };
}
