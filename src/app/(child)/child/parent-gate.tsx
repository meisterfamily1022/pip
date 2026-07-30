import { useRef, useState } from 'react';
import { router } from 'expo-router';
import { StyleSheet, Text, TextInput, View, type NativeSyntheticEvent, type TextInputKeyPressEventData } from 'react-native';

import { LockIcon } from '@/design/icons';
import {
  BackPill,
  Body,
  ErrorText,
  Eyebrow,
  IconWell,
  ModeBadge,
  PrimaryButton,
  Screen,
  ScreenTitle,
  TintPanel,
  tintColors,
} from '@/design/primitives';
import { colors, fontSizes, radii, spacing } from '@/design/tokens';
import { verifyParentPin } from '@/features/parent-access/parent-pin';

const PIN_LENGTH = 4;
const EMPTY_PIN: string[] = ['', '', '', ''];

const WRONG_PIN_MESSAGE = "That PIN doesn't look right — try again.";

/**
 * Parent PIN Gate — the grown-up door out of Child Mode.
 *
 * Four single-digit boxes rather than one field, so a parent can enter the PIN
 * quickly without the child seeing a full-width secret.
 */
export default function ParentGateRoute() {
  const [digits, setDigits] = useState<string[]>(EMPTY_PIN);
  const [error, setError] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);
  const inputs = useRef<(TextInput | null)[]>([]);

  const complete = digits.every((digit) => digit !== '');

  const handleChange = (index: number, value: string): void => {
    const digit = value.replace(/\D/g, '').slice(-1);
    setDigits((previous) => previous.map((existing, position) => (position === index ? digit : existing)));
    setError(null);
    if (digit && index < PIN_LENGTH - 1) inputs.current[index + 1]?.focus();
  };

  const handleKeyPress = (index: number, event: NativeSyntheticEvent<TextInputKeyPressEventData>): void => {
    if (event.nativeEvent.key !== 'Backspace' || digits[index] !== '' || index === 0) return;
    setDigits((previous) => previous.map((existing, position) => (position === index - 1 ? '' : existing)));
    inputs.current[index - 1]?.focus();
  };

  const submit = async (): Promise<void> => {
    if (!complete || checking) return;
    setChecking(true);
    try {
      if (await verifyParentPin(digits.join(''))) {
        setDigits(EMPTY_PIN);
        setError(null);
        router.replace('/parent/home');
        return;
      }
      setError(WRONG_PIN_MESSAGE);
    } catch {
      setError(WRONG_PIN_MESSAGE);
    } finally {
      setChecking(false);
    }
  };

  const goChildHome = (): void => {
    if (router.canGoBack()) router.back();
    else router.replace('/child/home');
  };

  return (
    <Screen mode="child">
      <View style={styles.topRow}>
        <BackPill label="Child home" onPress={goChildHome} />
        <ModeBadge mode="child" />
      </View>

      <View style={styles.intro}>
        <View style={styles.lock}>
          <IconWell size={72} tint="lilac">
            <LockIcon size={34} color={tintColors('lilac').foreground} />
          </IconWell>
        </View>
        <Eyebrow>GROWN-UP AREA</Eyebrow>
        <ScreenTitle style={styles.heading}>Parent Mode</ScreenTitle>
        <Body style={styles.lede}>Enter your four-digit PIN to continue.</Body>
      </View>

      <TintPanel tint="lilac">
        <Text style={styles.fieldLabel}>Parent PIN</Text>
        <View style={styles.digits}>
          {digits.map((digit, index) => (
            <TextInput
              accessibilityLabel={`PIN digit ${index + 1} of ${PIN_LENGTH}`}
              autoFocus={index === 0}
              key={index}
              keyboardType="number-pad"
              maxLength={1}
              onChangeText={(value) => handleChange(index, value)}
              onKeyPress={(event) => handleKeyPress(index, event)}
              ref={(element) => { inputs.current[index] = element; }}
              secureTextEntry
              style={[styles.digitBox, error !== null && styles.digitBoxError]}
              value={digit}
            />
          ))}
        </View>
        <PrimaryButton
          accessibilityLabel="Continue to Parent Mode"
          disabled={!complete || checking}
          label="Continue"
          onPress={() => { void submit(); }}
        />
        {error ? (
          <View style={styles.error}>
            <ErrorText>{error}</ErrorText>
          </View>
        ) : null}
      </TintPanel>
    </Screen>
  );
}

const styles = StyleSheet.create({
  digitBox: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radii.action,
    borderWidth: 2,
    color: colors.textPrimary,
    fontSize: 26,
    height: 64,
    textAlign: 'center',
    width: 56,
  },
  digitBoxError: { borderColor: colors.danger },
  digits: { flexDirection: 'row', gap: spacing.md, justifyContent: 'center', marginBottom: 22, marginTop: spacing.md },
  error: { alignItems: 'center', marginTop: spacing.md },
  fieldLabel: { color: colors.textPrimary, fontSize: fontSizes.label, fontWeight: '700' },
  heading: { fontSize: fontSizes.heading, textAlign: 'center' },
  intro: { alignItems: 'center', gap: spacing.sm, marginBottom: spacing.xxxl, marginTop: spacing.xxl },
  lede: { marginTop: spacing.xs, textAlign: 'center' },
  lock: { marginBottom: 14 },
  topRow: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
});
