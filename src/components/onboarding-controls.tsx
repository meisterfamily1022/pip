import { StyleSheet, Text, View } from 'react-native';

import type { ChoiceLimit } from '@/domain/models';
import { playmapTheme as theme } from '@/theme/playmap-theme';
import {
  BackNavigation,
  PrimaryButton as SharedPrimaryButton,
  RoundedTextInput,
  SegmentedControl,
  ToggleRow,
} from './playmap-ui';

/**
 * The controls setup screens share. They are thin wrappers over the design
 * system so onboarding cannot drift into its own button and field styles.
 */

export function PrimaryButton({
  label,
  onPress,
  disabled = false,
  busy = false,
  accessibilityLabel,
}: {
  label: string;
  onPress(): void;
  disabled?: boolean;
  busy?: boolean;
  accessibilityLabel?: string;
}) {
  return <SharedPrimaryButton accessibilityLabel={accessibilityLabel} busy={busy} disabled={disabled} label={label} onPress={onPress} />;
}

export function BackButton({ onPress }: { onPress(): void }) {
  return <BackNavigation label="Back" onPress={onPress} />;
}

export function Field({
  label,
  value,
  onChangeText,
  error,
  placeholder,
  keyboardType,
  secureTextEntry,
  maxLength,
  editable = true,
  hint,
  autoFocus,
  returnKeyType,
  onSubmitEditing,
}: {
  label: string;
  value: string;
  onChangeText(value: string): void;
  error?: string | null;
  placeholder?: string;
  keyboardType?: 'default' | 'number-pad';
  secureTextEntry?: boolean;
  maxLength?: number;
  editable?: boolean;
  hint?: string;
  autoFocus?: boolean;
  returnKeyType?: 'done' | 'next';
  onSubmitEditing?(): void;
}) {
  return (
    <RoundedTextInput
      accessibilityLabel={label}
      autoFocus={autoFocus}
      editable={editable}
      error={error}
      hint={hint}
      keyboardType={keyboardType}
      label={label}
      maxLength={maxLength}
      onChangeText={onChangeText}
      onSubmitEditing={onSubmitEditing}
      placeholder={placeholder}
      returnKeyType={returnKeyType}
      secureTextEntry={secureTextEntry}
      value={value}
    />
  );
}

/**
 * How many toys a child is offered at once, and whether tidying the last toy
 * away comes before the next one.
 */
export function ChoiceControls({
  choiceLimit,
  onChoiceLimitChange,
  cleanupRequired,
  onCleanupRequiredChange,
  childName,
}: {
  choiceLimit: ChoiceLimit;
  onChoiceLimitChange(value: ChoiceLimit): void;
  cleanupRequired: boolean;
  onCleanupRequiredChange(value: boolean): void;
  childName?: string;
}) {
  return (
    <View style={styles.group}>
      <View style={styles.field}>
        <Text style={styles.label}>How many choices at once?</Text>
        <SegmentedControl<ChoiceLimit>
          accessibilityLabel="How many choices at once"
          getOptionLabel={(limit) => `${limit} toy${limit === 1 ? '' : 's'}`}
          onChange={onChoiceLimitChange}
          options={[1, 3, 5]}
          value={choiceLimit}
        />
        <Text style={styles.caption}>
          {choiceLimit === 1
            ? 'One at a time is the calmest place to start.'
            : `${childName ? `${childName} sees` : 'Your child sees'} ${choiceLimit} toys to pick between.`}
        </Text>
      </View>
      <ToggleRow
        description="Pip walks through putting the last toy away first."
        label="Tidy up before the next toy"
        onValueChange={onCleanupRequiredChange}
        value={cleanupRequired}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  group: { gap: theme.spacing[16] },
  field: { gap: 6 },
  label: { color: theme.colors.primaryText, ...theme.typography.fieldLabel },
  caption: { color: theme.colors.secondaryText, ...theme.typography.meta },
});
