import { runMigrations } from '@/database/migrations';
import { RealSqliteConnection } from '@/database/real-sqlite-connection.test-helper';
import { getChildProfile, listChildProfiles } from '@/repositories/child-profiles-repository';
import { ensureSettings, getSettings } from '@/repositories/settings-repository';
import { completeOnboarding } from './complete-onboarding';
import { saveFirstChildProfile } from './onboarding-progress';

describe('progressive onboarding persistence', () => {
  let database: RealSqliteConnection;

  beforeEach(async () => {
    database = new RealSqliteConnection();
    await runMigrations(database);
    await ensureSettings(database);
  });

  afterEach(() => database.close());

  const child = {
    name: '  Maya  ',
    avatarId: 'petal-ring',
    accentColorId: 'lavender',
    readingSupport: 'pictures',
    choiceLimit: 5 as const,
    cleanupRequired: false,
  };

  it('stores the entered child name and preferences in canonical SQLite state', async () => {
    const saved = await saveFirstChildProfile(database, child);
    expect(saved).toMatchObject({ name: 'Maya', choiceLimit: 5, readingSupport: 'pictures' });
    await expect(getSettings(database)).resolves.toMatchObject({
      childNickname: 'Maya', activeChildId: saved.id, choiceLimit: 5, cleanupRequired: false,
    });
    await expect(getChildProfile(database, saved.id)).resolves.toMatchObject({ name: 'Maya' });
  });

  it('updates the same first child on retry instead of duplicating it', async () => {
    const first = await saveFirstChildProfile(database, child);
    const retry = await saveFirstChildProfile(database, { ...child, name: 'Maya Rose' });
    expect(retry.id).toBe(first.id);
    expect(await listChildProfiles(database)).toHaveLength(1);
    await expect(getSettings(database)).resolves.toMatchObject({ childNickname: 'Maya Rose' });
  });

  it('keeps the persisted child name when location setup resumes with an empty draft', async () => {
    const saved = await saveFirstChildProfile(database, child);
    await completeOnboarding(database, {
      childNickname: '',
      choiceLimit: 3,
      cleanupRequired: true,
      roomName: 'Playroom',
      storageSpotName: 'Blue Bin',
    });
    expect(await listChildProfiles(database)).toHaveLength(1);
    await expect(getSettings(database)).resolves.toMatchObject({
      onboardingCompleted: true,
      childNickname: 'Maya',
      activeChildId: saved.id,
      choiceLimit: 5,
      cleanupRequired: false,
    });
  });

  it('retries final location save without duplicating child, room, or storage rows', async () => {
    await saveFirstChildProfile(database, child);
    const input = { childNickname: '', choiceLimit: 3 as const, cleanupRequired: true, roomName: 'Playroom', storageSpotName: 'Blue Bin' };
    await completeOnboarding(database, input);
    await completeOnboarding(database, input);
    const counts = await Promise.all(['child_profiles', 'rooms', 'storage_spots'].map((table) =>
      database.getFirstAsync<{ count: number }>(`SELECT COUNT(*) AS count FROM ${table};`)));
    expect(counts.map((row) => row?.count)).toEqual([1, 1, 1]);
  });
});
