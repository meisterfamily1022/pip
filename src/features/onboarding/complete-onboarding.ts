import type { DatabaseConnection } from '@/database/types';
import type { ChoiceLimit } from '@/domain/models';
import { createRoom, createStorageSpot } from '@/repositories/rooms-repository';
import { updateSettings } from '@/repositories/settings-repository';
import { createChildProfile } from '@/repositories/child-profiles-repository';
import { telemetry } from '@/features/analytics/telemetry-client';

export type CompleteOnboardingInput = {
  childNickname: string;
  childAvatarId?: string;
  childAccentColorId?: string;
  childReadingSupport?: string;
  choiceLimit: ChoiceLimit;
  cleanupRequired: boolean;
  roomName: string;
  storageSpotName: string;
};

export async function completeOnboarding(database: DatabaseConnection, input: CompleteOnboardingInput): Promise<void> {
  await database.withTransactionAsync(async () => {
    const existingRoom = await database.getFirstAsync<{ id: number }>('SELECT id FROM rooms WHERE name = ? COLLATE NOCASE LIMIT 1;', input.roomName.trim());
    const room = existingRoom ?? await createRoom(database, input.roomName);
    const existingSpot = await database.getFirstAsync<{ id: number }>('SELECT id FROM storage_spots WHERE room_id = ? AND name = ? COLLATE NOCASE LIMIT 1;', room.id, input.storageSpotName.trim());
    if (!existingSpot) await createStorageSpot(database, room.id, input.storageSpotName);
    const existingChild = await database.getFirstAsync<{ id: number }>('SELECT id FROM child_profiles WHERE hidden_at IS NULL LIMIT 1;');
    const child = existingChild ?? await createChildProfile(database, {
      name: input.childNickname,
      avatarId: input.childAvatarId,
      accentColorId: input.childAccentColorId,
      readingSupport: input.childReadingSupport,
      choiceLimit: input.choiceLimit,
    });
    await updateSettings(database, {
      childNickname: input.childNickname.trim(),
      activeChildId: child.id,
      choiceLimit: input.choiceLimit,
      cleanupRequired: input.cleanupRequired,
      onboardingCompleted: true,
    });
  });
  void telemetry.track('onboarding_completed');
  void telemetry.track('first_room');
  void telemetry.track('first_storage_spot');
  void telemetry.track('first_child_profile');
}
