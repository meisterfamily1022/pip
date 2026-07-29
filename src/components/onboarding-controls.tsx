import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { ChoiceLimit } from '@/domain/models';
import { playmapTheme as theme } from '@/theme/playmap-theme';
import { PrimaryButton as SharedPrimaryButton, RoundedTextInput, SegmentedControl } from './playmap-ui';

type PrimaryButtonProps = { label: string; onPress(): void; disabled?: boolean; accessibilityLabel?: string };
export function PrimaryButton({ label, onPress, disabled = false, accessibilityLabel }: PrimaryButtonProps) {
  return <SharedPrimaryButton accessibilityLabel={accessibilityLabel} disabled={disabled} label={label} onPress={onPress} />;
}

type BackButtonProps = { onPress(): void };
export function BackButton({ onPress }: BackButtonProps) { return <Pressable accessibilityLabel="Go back" accessibilityRole="button" onPress={onPress} style={styles.backButton}><Text style={styles.backButtonText}>Back</Text></Pressable>; }

type FieldProps = { label: string; value: string; onChangeText(value: string): void; error?: string | null; placeholder?: string; keyboardType?: 'default' | 'number-pad'; secureTextEntry?: boolean; maxLength?: number };
export function Field({ label, value, onChangeText, error, placeholder, keyboardType, secureTextEntry, maxLength }: FieldProps) {
  return <RoundedTextInput accessibilityLabel={label} error={error} keyboardType={keyboardType} label={label} maxLength={maxLength} onChangeText={onChangeText} placeholder={placeholder} secureTextEntry={secureTextEntry} value={value} />;
}

type ChoiceControlProps = { choiceLimit: ChoiceLimit; onChoiceLimitChange(value: ChoiceLimit): void; cleanupRequired: boolean; onCleanupRequiredChange(value: boolean): void };
export function ChoiceControls({ choiceLimit, onChoiceLimitChange, cleanupRequired, onCleanupRequiredChange }: ChoiceControlProps) {
  return <View style={styles.choiceGroup}><Text style={styles.label}>Toy choices</Text><SegmentedControl accessibilityLabel="Toy choices" onChange={onChoiceLimitChange} options={[1, 3, 5]} value={choiceLimit} /><Text style={styles.label}>Require cleanup before another choice?</Text><SegmentedControl accessibilityLabel="Cleanup requirement" onChange={onCleanupRequiredChange} options={[true, false]} value={cleanupRequired} /></View>;
}

const styles = StyleSheet.create({
  primaryButton: { ...theme.shadows.card, alignItems: 'center', backgroundColor: theme.colors.coral, borderRadius: theme.radii.lg, minHeight: theme.sizes.button, justifyContent: 'center', paddingHorizontal: 20 },
  primaryButtonText: { color: '#FFFFFF', fontSize: 17, fontWeight: '700' },
  disabled: { opacity: 0.45 }, pressed: { opacity: 0.82 },
  backButton: { alignSelf: 'flex-start', minHeight: 44, justifyContent: 'center', paddingHorizontal: 4 }, backButtonText: { color: theme.colors.primary, fontSize: 16, fontWeight: '600' },
  field: { gap: 6 }, label: { color: theme.colors.text, fontSize: 16, fontWeight: '600' },
  input: { backgroundColor: theme.colors.surface, borderColor: theme.colors.border, borderRadius: theme.radii.md, borderWidth: 1, color: theme.colors.text, fontSize: 18, minHeight: theme.sizes.input, paddingHorizontal: 16 }, inputError: { borderColor: theme.colors.danger }, error: { color: theme.colors.danger, minHeight: 18 },
  choiceGroup: { gap: 12 }, optionRow: { flexDirection: 'row', gap: 10 }, option: { alignItems: 'center', backgroundColor: theme.colors.surface, borderColor: theme.colors.border, borderRadius: theme.radii.lg, borderWidth: 1, flex: 1, justifyContent: 'center', minHeight: 52 }, optionSelected: { borderColor: theme.colors.primary, backgroundColor: theme.colors.primarySoft, borderWidth: 2 }, optionText: { color: theme.colors.text, fontSize: 16, fontWeight: '600' },
});
