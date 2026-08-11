import { useState } from 'react';
import { router } from 'expo-router';
import { StyleSheet, Text } from 'react-native';

import { PrimaryButton } from '@/components/onboarding-controls';
import { OnboardingScreen } from '@/components/onboarding-screen';
import { PinInput } from '@/components/playmap-ui';
import { useOnboarding } from '@/features/onboarding/onboarding-context';
import { validatePin } from '@/features/onboarding/validation';
import { playmapTheme as theme } from '@/theme/playmap-theme';

/**
 * Step 1, first half: choose the PIN.
 *
 * There is deliberately no back control — nothing sits behind this screen, and
 * offering a way back to Welcome only invites a parent to wonder what they
 * missed. Confirmation is its own screen, so a mismatch can be explained
 * without blaming the second attempt.
 */
export default function ParentPinSetupRoute() {
  const { draft, updateDraft } = useOnboarding();
  const [error, setError] = useState<string | null>(null);

  const complete = draft.pin.length === 4;

  const continueToConfirm = (): void => {
    const validationError = validatePin(draft.pin);
    if (validationError) {
      setError(validationError);
      return;
    }
    // Any earlier confirmation is stale the moment the PIN itself changes.
    updateDraft({ pinConfirmation: '' });
    router.push('/parent-pin-confirm');
  };

  return (
    <OnboardingScreen
      description="Four digits, so Child Mode stays child-only. You can change it later in Settings."
      footer={<PrimaryButton disabled={!complete} label="Continue" onPress={continueToConfirm} />}
      step={1}
      title="Choose a parent PIN"
    >
      <PinInput
        accessibilityLabel="Parent PIN"
        autoFocus
        error={error}
        onChangeText={(pin) => {
          updateDraft({ pin });
          setError(null);
        }}
        value={draft.pin}
      />
      <Text style={styles.note}>You’ll confirm it on the next screen.</Text>
    </OnboardingScreen>
  );
}

const styles = StyleSheet.create({
  note: { color: theme.colors.secondaryText, textAlign: 'center', ...theme.typography.meta },
});
