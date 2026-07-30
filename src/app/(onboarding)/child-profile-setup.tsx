import { useState } from 'react';
import { router } from 'expo-router';

import { ChoiceControls } from '@/components/onboarding-controls';
import { OnboardingScreen } from '@/components/onboarding-screen';
import { PrimaryButton, TextField } from '@/design/primitives';
import { useOnboarding } from '@/features/onboarding/onboarding-context';
import { validateRequiredName } from '@/features/onboarding/validation';

export default function ChildProfileSetupRoute() {
  const { draft, updateDraft } = useOnboarding();
  const [error, setError] = useState<string | null>(null);

  const continueToLocation = (): void => {
    const validationError = validateRequiredName(draft.childNickname, 'Child nickname');
    if (validationError) {
      setError(validationError);
      return;
    }
    router.push('/first-location-setup');
  };

  return (
    <OnboardingScreen
      back={{ label: 'Parent PIN', onPress: () => router.back() }}
      description="Use a nickname and choose how much choice to offer."
      footer={<PrimaryButton label="Continue" onPress={continueToLocation} />}
      step="Step 2 of 3"
      title="Set up your child’s choices"
    >
      <TextField
        error={error}
        label="Child nickname"
        onChangeText={(value) => {
          updateDraft({ childNickname: value });
          setError(null);
        }}
        placeholder="For example, Sam"
        value={draft.childNickname}
      />
      <ChoiceControls
        choiceLimit={draft.choiceLimit}
        cleanupRequired={draft.cleanupRequired}
        onChoiceLimitChange={(choiceLimit) => updateDraft({ choiceLimit })}
        onCleanupRequiredChange={(cleanupRequired) => updateDraft({ cleanupRequired })}
      />
    </OnboardingScreen>
  );
}
