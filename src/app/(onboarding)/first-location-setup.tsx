import { useState } from 'react';
import { router } from 'expo-router';
import { Text } from 'react-native';

import { BackButton, Field, PrimaryButton } from '@/components/onboarding-controls';
import { OnboardingScreen } from '@/components/onboarding-screen';
import { completeOnboardingFlow } from '@/features/onboarding/complete-onboarding-flow';
import { useOnboarding } from '@/features/onboarding/onboarding-context';
import { validateRequiredName } from '@/features/onboarding/validation';
import { initializeDatabase } from '@/database/client';

export default function FirstLocationSetupRoute() {
  const { draft, updateDraft } = useOnboarding();
  const [roomError, setRoomError] = useState<string | null>(null);
  const [storageError, setStorageError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const finish = (): void => {
    const nextRoomError = validateRequiredName(draft.roomName, 'Room name');
    const nextStorageError = validateRequiredName(draft.storageSpotName, 'Storage spot name');
    setRoomError(nextRoomError);
    setStorageError(nextStorageError);
    if (nextRoomError || nextStorageError) return;
    setSubmitting(true);
    setSubmitError(null);
    initializeDatabase().then((database) => completeOnboardingFlow(database, draft)).then(() => router.replace('/parent/home')).catch((caught: unknown) => {
      const message = caught instanceof Error ? caught.message : 'Please try again.';
      setSubmitError(message.includes('UNIQUE constraint failed') ? 'That room already exists. Try a different room name.' : `Could not finish setup: ${message}`);
      setSubmitting(false);
    });
  };
  return <OnboardingScreen step="Step 3 of 3" title="Add your first location" description="Every toy needs a home. You can add more locations later." footer={<PrimaryButton label={submitting ? 'Finishing setup…' : 'Finish setup'} disabled={submitting} onPress={finish} />}><BackButton onPress={() => router.back()} /><Field label="Room" value={draft.roomName} onChangeText={(value) => { updateDraft({ roomName: value }); setRoomError(null); setSubmitError(null); }} placeholder="Playroom" error={roomError} /><Field label="Storage spot" value={draft.storageSpotName} onChangeText={(value) => { updateDraft({ storageSpotName: value }); setStorageError(null); setSubmitError(null); }} placeholder="Blue Bin" error={storageError} /><Text>Examples: Playroom → Blue Bin, Bedroom → Bottom Shelf, Homeschool Room → Craft Cabinet</Text><Text accessibilityLiveRegion="polite">{submitError ?? ''}</Text></OnboardingScreen>;
}
