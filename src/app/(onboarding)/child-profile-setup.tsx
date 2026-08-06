import { useState } from 'react';
import { router } from 'expo-router';

import { BackButton, ChoiceControls, Field, PrimaryButton } from '@/components/onboarding-controls';
import { OnboardingScreen } from '@/components/onboarding-screen';
import { useOnboarding } from '@/features/onboarding/onboarding-context';
import { validateChildNickname } from '@/features/onboarding/validation';

export default function ChildProfileSetupRoute() {
  const { draft, updateDraft } = useOnboarding();
  const [error, setError] = useState<string | null>(null);
  const continueToLocation = (): void => {
    const validationError = validateChildNickname(draft.childNickname);
    if (validationError) { setError(validationError); return; }
    router.push('/first-location-setup');
  };
  return <OnboardingScreen step="Step 2 of 3" title="Set up your child’s choices" description="Use a nickname and choose how much choice to offer." footer={<PrimaryButton label="Continue" onPress={continueToLocation} />}><BackButton onPress={() => router.canGoBack() ? router.back() : router.replace('/parent-pin-setup')} /><Field label="Child nickname" value={draft.childNickname} onChangeText={(value) => { updateDraft({ childNickname: value }); setError(null); }} placeholder="For example, Sam" error={error} /><ChoiceControls choiceLimit={draft.choiceLimit} onChoiceLimitChange={(choiceLimit) => updateDraft({ choiceLimit })} cleanupRequired={draft.cleanupRequired} onCleanupRequiredChange={(cleanupRequired) => updateDraft({ cleanupRequired })} /></OnboardingScreen>;
}
