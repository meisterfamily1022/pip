import type { DatabaseConnection } from '@/database/types';
import type { ChoiceLimit } from '@/domain/models';
import { createRoom, createStorageSpot } from '@/repositories/rooms-repository';
import { updateSettings } from '@/repositories/settings-repository';
import { createChildProfile } from '@/repositories/child-profiles-repository';

export type CompleteOnboardingInput = {
  childNickname: string;
  choiceLimit: ChoiceLimit;
  cleanupRequired: boolean;
  roomName: string;
  storageSpotName: string;
};

export async function completeOnboarding(database: DatabaseConnection, input: CompleteOnboardingInput): Promise<void> {
  await database.withTransactionAsync(async () => {
    const room = await createRoom(database, input.roomName);
    await createStorageSpot(database, room.id, input.storageSpotName);
    const child = await createChildProfile(database, input.childNickname);
    await updateSettings(database, {
      childNickname: input.childNickname.trim(),
      activeChildId: child.id,
      choiceLimit: input.choiceLimit,
      cleanupRequired: input.cleanupRequired,
      onboardingCompleted: true,
    });
  });
}
