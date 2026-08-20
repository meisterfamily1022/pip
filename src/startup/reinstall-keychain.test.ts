/* eslint-disable import/first */

jest.mock('@/database/client', () => ({
  initializeDatabase: jest.fn(),
  didCreateDatabaseThisLaunch: jest.fn(() => false),
}));
jest.mock('@/services/pin-storage', () => ({
  pinStorage: { getPin: jest.fn(), savePin: jest.fn(), deletePin: jest.fn(async () => undefined) },
}));
jest.mock('@/services/onboarding-progress-storage', () => ({
  onboardingProgressStorage: { getStarted: jest.fn(async () => true), markStarted: jest.fn(), clear: jest.fn(async () => undefined) },
}));

import { didCreateDatabaseThisLaunch, initializeDatabase } from '@/database/client';
import { runMigrations } from '@/database/migrations';
import { RealSqliteConnection } from '@/database/real-sqlite-connection.test-helper';
import { onboardingProgressStorage } from '@/services/onboarding-progress-storage';
import { pinStorage } from '@/services/pin-storage';

import { initializeApp } from './initialize-app';
import { getStartupDestination } from './startup-routing';

/**
 * Reinstalling Pip.
 *
 * iOS deletes an app's files but keeps its keychain items, so a reinstall
 * begins with an empty database and a parent PIN belonging to an installation
 * that no longer exists. Startup read that PIN and skipped setup to "Add a
 * child" — past the welcome screen, past every account option, and into a
 * Parent Mode guarded by a PIN set for data that had been deleted.
 */
beforeEach(async () => {
  jest.clearAllMocks();
  const database = new RealSqliteConnection();
  await runMigrations(database);
  await database.runAsync(
    `INSERT INTO settings (id, onboarding_completed, choice_limit, cleanup_required, created_at, updated_at)
     VALUES (1, 0, 3, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);`,
  );
  (initializeDatabase as jest.Mock).mockResolvedValue(database);
  (pinStorage.getPin as jest.Mock).mockResolvedValue('1234');
});

describe('keychain left behind by a previous install', () => {
  it('is discarded when this launch created the database', async () => {
    (didCreateDatabaseThisLaunch as jest.Mock).mockReturnValue(true);

    await initializeApp();

    expect(pinStorage.deletePin).toHaveBeenCalledTimes(1);
    expect(onboardingProgressStorage.clear).toHaveBeenCalledTimes(1);
  });

  it('sends a reinstalling parent to the welcome screen, not into the middle of setup', async () => {
    (didCreateDatabaseThisLaunch as jest.Mock).mockReturnValue(true);
    // The PIN is gone by the time routing reads it.
    (pinStorage.getPin as jest.Mock).mockResolvedValue(null);
    (onboardingProgressStorage.getStarted as jest.Mock).mockResolvedValue(false);

    const state = await initializeApp();

    expect(getStartupDestination(state, false)).toBe('/onboarding');
  });

  it('leaves an existing install alone, PIN and all', async () => {
    (didCreateDatabaseThisLaunch as jest.Mock).mockReturnValue(false);

    await initializeApp();

    expect(pinStorage.deletePin).not.toHaveBeenCalled();
    expect(onboardingProgressStorage.clear).not.toHaveBeenCalled();
  });

  it('does not interrupt a parent midway through setup on an existing install', async () => {
    (didCreateDatabaseThisLaunch as jest.Mock).mockReturnValue(false);

    const state = await initializeApp();

    // PIN set, no child yet: setup resumes where they left off.
    expect(state.hasPin).toBe(true);
    expect(getStartupDestination(state, true)).toBe('/child-profile-setup');
  });
});
