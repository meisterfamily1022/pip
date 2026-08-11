import { useState } from 'react';
import { router } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

import { ParentDetailScreen } from '@/components/parent-ui';
import { Banner, PinInput, PrimaryButton, Toast } from '@/components/playmap-ui';
import { changeParentPin } from '@/features/settings/settings-service';
import { pinStorage } from '@/services/pin-storage';
import { playmapTheme as theme } from '@/theme/playmap-theme';

type Step = 'current' | 'new' | 'confirm' | 'done';

/**
 * Changing the parent PIN, one question per screen.
 *
 * The same shape as setting it during onboarding: enter, then confirm, with a
 * mismatch explained rather than blamed. The current PIN is checked first, so a
 * parent who has forgotten it finds out immediately rather than after choosing
 * a new one.
 */
export default function ChangePinRoute() {
  const [step, setStep] = useState<Step>('current');
  const [currentPin, setCurrentPin] = useState('');
  const [newPin, setNewPin] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const value = step === 'current' ? currentPin : step === 'new' ? newPin : confirmation;
  const setValue = step === 'current' ? setCurrentPin : step === 'new' ? setNewPin : setConfirmation;

  const advance = async (): Promise<void> => {
    setError(null);
    if (step === 'current') {
      setStep('new');
      return;
    }
    if (step === 'new') {
      if (newPin === currentPin) {
        setError('That is already your PIN. Choose a different one.');
        return;
      }
      setStep('confirm');
      return;
    }
    setSaving(true);
    try {
      await changeParentPin(pinStorage, { currentPin, newPin, confirmation });
      setStep('done');
    } catch (caught: unknown) {
      const message = caught instanceof Error ? caught.message : 'The PIN could not be changed.';
      setError(message);
      // A wrong current PIN is only discoverable at save time, so send the
      // parent back to the field that is actually wrong.
      if (message.includes('Current PIN')) {
        setStep('current');
        setCurrentPin('');
        setNewPin('');
        setConfirmation('');
      } else {
        setConfirmation('');
      }
    } finally {
      setSaving(false);
    }
  };

  if (step === 'done') {
    return (
      <ParentDetailScreen
        backLabel="Settings"
        backTo="/parent/settings"
        footer={<PrimaryButton label="Back to Settings" onPress={() => router.replace('/parent/settings')} />}
      >
        <View style={styles.header}>
          <Text accessibilityRole="header" style={styles.title}>PIN changed</Text>
          <Text style={styles.subtitle}>Child Mode now needs the new four digits to get back here.</Text>
        </View>
        <Toast message="Your parent PIN has been changed." />
      </ParentDetailScreen>
    );
  }

  const copy = {
    current: { title: 'Enter your current PIN', body: 'This confirms it is you before anything changes.', label: 'Current PIN' },
    new: { title: 'Choose a new PIN', body: 'Four digits. You will confirm it on the next screen.', label: 'New PIN' },
    confirm: { title: 'Type it once more', body: 'Confirming makes sure it is the PIN you meant.', label: 'Confirm new PIN' },
  }[step];

  return (
    <ParentDetailScreen
      backLabel="Settings"
      backTo="/parent/settings"
      footer={
        <PrimaryButton
          busy={saving}
          disabled={value.length !== 4}
          label={step === 'confirm' ? 'Change my PIN' : 'Continue'}
          onPress={() => {
            void advance();
          }}
        />
      }
    >
      <View style={styles.header}>
        <Text accessibilityRole="header" style={styles.title}>{copy.title}</Text>
        <Text style={styles.subtitle}>{copy.body}</Text>
      </View>

      {error ? <Banner message={error} tone="alert" /> : null}

      <PinInput
        accessibilityLabel={copy.label}
        autoFocus
        error={error ? '' : null}
        key={step}
        onChangeText={(next) => {
          setValue(next);
          setError(null);
        }}
        value={value}
      />
    </ParentDetailScreen>
  );
}

const styles = StyleSheet.create({
  header: { gap: 2, marginTop: theme.spacing[16] },
  title: { color: theme.colors.primaryText, ...theme.typography.pageTitle },
  subtitle: { color: theme.colors.secondaryText, ...theme.typography.body },
});
