import type { DatabaseConnection } from '@/database/types';
import type { ChoiceLimit, ChildProfile } from '@/domain/models';
import { createChildProfile, getChildProfile, listChildProfiles, updateChildProfile } from '@/repositories/child-profiles-repository';
import { getSettings, updateSettings } from '@/repositories/settings-repository';

export type FirstChildInput = {
  name: string;
  avatarId: string;
  accentColorId: string;
  readingSupport: string;
  choiceLimit: ChoiceLimit;
  cleanupRequired: boolean;
};

/**
 * Persists the first profile before location setup. A retry updates the same
 * canonical child instead of creating another row.
 */
export async function saveFirstChildProfile(database: DatabaseConnection, input: FirstChildInput): Promise<ChildProfile> {
  let saved: ChildProfile | null = null;
  await database.withTransactionAsync(async () => {
    const settings = await getSettings(database);
    const active = settings.activeChildId ? await getChildProfile(database, settings.activeChildId) : null;
    const existing = active ?? (await listChildProfiles(database))[0] ?? null;
    const details = {
      name: input.name.trim(),
      avatarId: input.avatarId,
      accentColorId: input.accentColorId,
      readingSupport: input.readingSupport,
      choiceLimit: input.choiceLimit,
    };
    const child = existing
      ? await updateChildProfile(database, existing.id, details)
      : await createChildProfile(database, details);
    await updateSettings(database, {
      childNickname: child.name,
      activeChildId: child.id,
      choiceLimit: child.choiceLimit,
      cleanupRequired: input.cleanupRequired,
    });
    saved = child;
  });
  if (!saved) throw new Error('This profile could not be saved.');
  return saved;
}
