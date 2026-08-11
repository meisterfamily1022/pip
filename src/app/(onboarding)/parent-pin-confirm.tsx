import { useState } from 'react';
import { router } from 'expo-router';

import { PrimaryButton } from '@/components/onboarding-controls';
import { OnboardingScreen } from '@/components/onboarding-screen';
import { Banner, PinInput, SecondaryButton } from '@/components/playmap-ui';
import { useOnboarding } from '@/features/onboarding/onboarding-context';
import { validatePinConfirmation } from '@/features/onboarding/validation';

/**
 * Step 1, second half: confirm the PIN.
 *
 * A mismatch is stated as a fact about the two entries rather than as a
 * mistake the parent made, and both ways out are offered: try the confirmation
 * again, or start over and choose a different PIN.
 */
export default function ParentPinConfirmRoute() {
  const { draft, updateDraft } = useOnboarding();
  const [mismatch, setMismatch] = useState(false);

  const complete = draft.pinConfirmation.length === 4;

  const goBack = (): void => {
    if (router.canGoBack()) router.back();
    else router.replace('/parent-pin-setup');
  };

  const startOver = (): void => {
    updateDraft({ pin: '', pinConfirmation: '' });
    setMismatch(false);
    goBack();
  };

  const continueToProfile = (): void => {
    if (validatePinConfirmation(draft.pin, draft.pinConfirmation)) {
      setMismatch(true);
      return;
    }
    router.push('/child-profile-setup');
  };

  return (
    <OnboardingScreen
      description="Confirming makes sure it’s the PIN you meant."
      footer={<PrimaryButton disabled={!complete} label="Continue" onPress={continueToProfile} />}
      onBack={goBack}
      step={1}
      title="Type it once more"
    >
      {mismatch ? (
        <>
          <Banner
            message="These two PINs are different. Tap Start over to choose a new one, or try the confirmation again."
            tone="alert"
          />
          <SecondaryButton label="Start over" onPress={startOver} />
        </>
      ) : null}

      <PinInput
        accessibilityLabel="Confirm parent PIN"
        autoFocus
        error={mismatch ? 'Those PINs don’t match yet.' : null}
        onChangeText={(pinConfirmation) => {
          updateDraft({ pinConfirmation });
          setMismatch(false);
        }}
        value={draft.pinConfirmation}
      />
    </OnboardingScreen>
  );
}
