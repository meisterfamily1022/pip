import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import {
  BackLink,
  Body,
  ModeBadge,
  PrimaryButton,
  Screen,
  ScreenTitle,
  SuccessText,
  TextField,
  TintPanel,
} from '@/design/primitives';
import { spacing } from '@/design/tokens';

/**
 * Shared chrome for the two location forms — Add Room / Add storage spot and
 * Edit room / Edit storage spot. Both screens are the same page in the design:
 * parent chrome, a heading pair, and a peach panel holding one name field and
 * its submit action.
 */

/** Returns to Rooms & Storage, even when the screen was opened by deep link. */
export function goBackToLocations(): void {
  if (router.canGoBack()) router.back();
  else router.replace('/parent/locations');
}

type LocationFormScreenProps = {
  title: string;
  description: string;
  fieldLabel: string;
  placeholder?: string;
  value: string;
  onChangeText(value: string): void;
  error?: string | null;
  submitLabel: string;
  onSubmit(): void;
  /** Disables the action while a write is in flight. */
  submitting?: boolean;
  /** Confirmation line shown under the panel after a successful write. */
  success?: string | null;
};

export function LocationFormScreen({
  title,
  description,
  fieldLabel,
  placeholder,
  value,
  onChangeText,
  error,
  submitLabel,
  onSubmit,
  submitting = false,
  success,
}: LocationFormScreenProps) {
  const disabled = submitting || value.trim().length === 0;
  return (
    <Screen mode="parent" contentStyle={styles.content}>
      <BackLink label="Rooms & Storage" onPress={goBackToLocations} />
      <View style={styles.heading}>
        <ModeBadge mode="parent" />
        <ScreenTitle>{title}</ScreenTitle>
        <Body>{description}</Body>
      </View>
      <TintPanel tint="peach">
        <TextField
          error={error}
          label={fieldLabel}
          onChangeText={onChangeText}
          placeholder={placeholder}
          value={value}
        />
        <PrimaryButton
          disabled={disabled}
          label={submitting ? 'Saving…' : submitLabel}
          onPress={onSubmit}
          style={styles.submit}
        />
      </TintPanel>
      {success ? <SuccessText>{`✓ ${success}`}</SuccessText> : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { gap: spacing.xl },
  heading: { gap: spacing.sm },
  submit: { alignSelf: 'flex-start', marginTop: spacing.xl },
});
