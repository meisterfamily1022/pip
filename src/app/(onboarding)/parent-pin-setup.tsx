import { useState } from 'react';
import { router } from 'expo-router';

import { BackButton, Field, PrimaryButton } from '@/components/onboarding-controls';
import { OnboardingScreen } from '@/components/onboarding-screen';
import { useOnboarding } from '@/features/onboarding/onboarding-context';
import { validatePinConfirmation } from '@/features/onboarding/validation';

const digitsOnly = (value: string): string => value.replace(/\D/g, '').slice(0, 4);

export default function ParentPinSetupRoute() {
  const { draft, updateDraft } = useOnboarding();
  const [error, setError] = useState<string | null>(null);
  const continueToProfile = (): void => {
    const validationError = validatePinConfirmation(draft.pin, draft.pinConfirmation);
    if (validationError) { setError(validationError); return; }
    router.push('/child-profile-setup');
  };
  return <OnboardingScreen step="Step 1 of 3" title="Create a parent PIN" description="Use a four-digit PIN to protect parent controls." footer={<PrimaryButton label="Continue" onPress={continueToProfile} />}><BackButton onPress={() => router.canGoBack() ? router.back() : router.replace('/onboarding')} /><Field label="PIN" value={draft.pin} onChangeText={(value) => { updateDraft({ pin: digitsOnly(value) }); setError(null); }} keyboardType="number-pad" secureTextEntry maxLength={4} /><Field label="Confirm PIN" value={draft.pinConfirmation} onChangeText={(value) => { updateDraft({ pinConfirmation: digitsOnly(value) }); setError(null); }} keyboardType="number-pad" secureTextEntry maxLength={4} error={error} /></OnboardingScreen>;
}
