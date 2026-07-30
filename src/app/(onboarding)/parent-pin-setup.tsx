import { useState } from 'react';
import { router } from 'expo-router';

import { OnboardingScreen } from '@/components/onboarding-screen';
import { PrimaryButton, TextField } from '@/design/primitives';
import { useOnboarding } from '@/features/onboarding/onboarding-context';
import { validatePinConfirmation } from '@/features/onboarding/validation';

const digitsOnly = (value: string): string => value.replace(/\D/g, '').slice(0, 4);

export default function ParentPinSetupRoute() {
  const { draft, updateDraft } = useOnboarding();
  const [error, setError] = useState<string | null>(null);

  const continueToProfile = (): void => {
    const validationError = validatePinConfirmation(draft.pin, draft.pinConfirmation);
    if (validationError) {
      setError(validationError);
      return;
    }
    router.push('/child-profile-setup');
  };

  return (
    <OnboardingScreen
      back={{ label: 'Welcome', onPress: () => router.back() }}
      description="Use a four-digit PIN to protect parent controls."
      footer={<PrimaryButton label="Continue" onPress={continueToProfile} />}
      step="Step 1 of 3"
      title="Create a parent PIN"
    >
      <TextField
        keyboardType="number-pad"
        label="PIN"
        maxLength={4}
        onChangeText={(value) => {
          updateDraft({ pin: digitsOnly(value) });
          setError(null);
        }}
        placeholder="••••"
        secureTextEntry
        value={draft.pin}
      />
      <TextField
        error={error}
        keyboardType="number-pad"
        label="Confirm PIN"
        maxLength={4}
        onChangeText={(value) => {
          updateDraft({ pinConfirmation: digitsOnly(value) });
          setError(null);
        }}
        placeholder="••••"
        secureTextEntry
        value={draft.pinConfirmation}
      />
    </OnboardingScreen>
  );
}
