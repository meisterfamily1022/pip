import { useState } from 'react';
import { router } from 'expo-router';

import { OnboardingScreen } from '@/components/onboarding-screen';
import { initializeDatabase } from '@/database/client';
import { Caption, ErrorText, PrimaryButton, TextField } from '@/design/primitives';
import { completeOnboardingFlow } from '@/features/onboarding/complete-onboarding-flow';
import { useOnboarding } from '@/features/onboarding/onboarding-context';
import { validateRequiredName } from '@/features/onboarding/validation';

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
    initializeDatabase()
      .then((database) => completeOnboardingFlow(database, draft))
      .then(() => router.replace('/parent/home'))
      .catch((caught: unknown) => {
        const message = caught instanceof Error ? caught.message : 'Please try again.';
        setSubmitError(
          message.includes('UNIQUE constraint failed')
            ? 'That room already exists. Try a different room name.'
            : `Could not finish setup: ${message}`,
        );
        setSubmitting(false);
      });
  };

  return (
    <OnboardingScreen
      back={{ label: 'Child setup', onPress: () => router.back() }}
      description="Every toy needs a home. You can add more locations later."
      footer={
        <PrimaryButton
          disabled={submitting}
          label={submitting ? 'Finishing setup…' : 'Finish setup'}
          onPress={finish}
        />
      }
      step="Step 3 of 3"
      title="Add your first location"
    >
      <TextField
        error={roomError}
        label="Room"
        onChangeText={(value) => {
          updateDraft({ roomName: value });
          setRoomError(null);
          setSubmitError(null);
        }}
        placeholder="Playroom"
        value={draft.roomName}
      />
      <TextField
        error={storageError}
        label="Storage spot"
        onChangeText={(value) => {
          updateDraft({ storageSpotName: value });
          setStorageError(null);
          setSubmitError(null);
        }}
        placeholder="Blue Bin"
        value={draft.storageSpotName}
      />
      <Caption>Examples: Playroom → Blue Bin, Bedroom → Bottom Shelf, Homeschool Room → Craft Cabinet</Caption>
      {submitError ? <ErrorText>{submitError}</ErrorText> : null}
    </OnboardingScreen>
  );
}
