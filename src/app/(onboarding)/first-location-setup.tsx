import { useState } from 'react';
import { router } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

import { Field, PrimaryButton } from '@/components/onboarding-controls';
import { OnboardingScreen } from '@/components/onboarding-screen';
import { Banner, FilterChip } from '@/components/playmap-ui';
import { initializeDatabase } from '@/database/client';
import { completeOnboardingFlow } from '@/features/onboarding/complete-onboarding-flow';
import { useOnboarding } from '@/features/onboarding/onboarding-context';
import { validateRequiredName } from '@/features/onboarding/validation';
import { markOnboardingComplete } from '@/startup/route-access';
import { playmapTheme as theme } from '@/theme/playmap-theme';

/** Common spots, offered so the parent can tap rather than type. */
const spotSuggestions = ['Toy box', 'Shelf', 'Basket', 'Under bed'];

export default function FirstLocationSetupRoute() {
  const { draft, updateDraft } = useOnboarding();
  const [roomError, setRoomError] = useState<string | null>(null);
  const [storageError, setStorageError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const goBack = (): void => {
    if (router.canGoBack()) router.back();
    else router.replace('/child-profile-preferences');
  };

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
      .then(() => {
        markOnboardingComplete();
        router.replace('/ready');
      })
      .catch((caught: unknown) => {
        const message = caught instanceof Error ? caught.message : 'Please try again.';
        setSubmitError(
          message.includes('UNIQUE constraint failed')
            ? 'That room already exists. Try a different room name.'
            : `Setup could not finish: ${message}`,
        );
        setSubmitting(false);
      });
  };

  return (
    <OnboardingScreen
      description="One room and one spot inside it. Add more later."
      footer={<PrimaryButton busy={submitting} label={submitting ? 'Finishing setup…' : 'Finish setup'} onPress={finish} />}
      onBack={goBack}
      step={3}
      title="Where do toys live?"
    >
      {submitError ? <Banner message={submitError} tone="alert" /> : null}

      <Field
        error={roomError}
        label="Room"
        onChangeText={(roomName) => {
          updateDraft({ roomName });
          setRoomError(null);
          setSubmitError(null);
        }}
        placeholder="Playroom"
        returnKeyType="next"
        value={draft.roomName}
      />

      <View style={styles.spotField}>
        <Field
          error={storageError}
          label="Storage spot"
          onChangeText={(storageSpotName) => {
            updateDraft({ storageSpotName });
            setStorageError(null);
            setSubmitError(null);
          }}
          placeholder="White shelf"
          returnKeyType="done"
          value={draft.storageSpotName}
        />
        <View style={styles.suggestions}>
          {spotSuggestions.map((suggestion) => (
            <FilterChip
              key={suggestion}
              label={suggestion}
              onPress={() => {
                updateDraft({ storageSpotName: suggestion });
                setStorageError(null);
              }}
              selected={draft.storageSpotName === suggestion}
            />
          ))}
        </View>
      </View>

      <Text style={styles.examples}>
        A spot is wherever the toy actually goes back to — a shelf, a bin, a drawer.
      </Text>
    </OnboardingScreen>
  );
}

const styles = StyleSheet.create({
  spotField: { gap: theme.spacing[8] },
  suggestions: { flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing[8] },
  examples: { color: theme.colors.secondaryText, ...theme.typography.meta },
});
