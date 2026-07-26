import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import type { ChoiceLimit } from '@/domain/models';

type PrimaryButtonProps = { label: string; onPress(): void; disabled?: boolean; accessibilityLabel?: string };
export function PrimaryButton({ label, onPress, disabled = false, accessibilityLabel }: PrimaryButtonProps) {
  return <Pressable accessibilityLabel={accessibilityLabel ?? label} accessibilityRole="button" disabled={disabled} onPress={onPress} style={({ pressed }) => [styles.primaryButton, disabled && styles.disabled, pressed && !disabled && styles.pressed]}><Text style={styles.primaryButtonText}>{label}</Text></Pressable>;
}

type BackButtonProps = { onPress(): void };
export function BackButton({ onPress }: BackButtonProps) { return <Pressable accessibilityLabel="Go back" accessibilityRole="button" onPress={onPress} style={styles.backButton}><Text style={styles.backButtonText}>Back</Text></Pressable>; }

type FieldProps = { label: string; value: string; onChangeText(value: string): void; error?: string | null; placeholder?: string; keyboardType?: 'default' | 'number-pad'; secureTextEntry?: boolean; maxLength?: number };
export function Field({ label, value, onChangeText, error, placeholder, keyboardType, secureTextEntry, maxLength }: FieldProps) {
  return <View style={styles.field}><Text style={styles.label}>{label}</Text><TextInput accessibilityLabel={label} value={value} onChangeText={onChangeText} placeholder={placeholder} keyboardType={keyboardType} secureTextEntry={secureTextEntry} maxLength={maxLength} style={[styles.input, error && styles.inputError]} /><Text accessibilityLiveRegion="polite" style={styles.error}>{error ?? ''}</Text></View>;
}

type ChoiceControlProps = { choiceLimit: ChoiceLimit; onChoiceLimitChange(value: ChoiceLimit): void; cleanupRequired: boolean; onCleanupRequiredChange(value: boolean): void };
export function ChoiceControls({ choiceLimit, onChoiceLimitChange, cleanupRequired, onCleanupRequiredChange }: ChoiceControlProps) {
  return <View style={styles.choiceGroup}><Text style={styles.label}>Toy choices</Text><View style={styles.optionRow}>{([1, 3, 5] as const).map((value) => <Pressable key={value} accessibilityLabel={`${value} toy choices`} accessibilityRole="radio" accessibilityState={{ selected: choiceLimit === value }} onPress={() => onChoiceLimitChange(value)} style={[styles.option, choiceLimit === value && styles.optionSelected]}><Text style={styles.optionText}>{value}</Text></Pressable>)}</View><Text style={styles.label}>Require cleanup before another choice?</Text><View style={styles.optionRow}>{([true, false] as const).map((value) => <Pressable key={String(value)} accessibilityLabel={value ? 'Cleanup required on' : 'Cleanup required off'} accessibilityRole="radio" accessibilityState={{ selected: cleanupRequired === value }} onPress={() => onCleanupRequiredChange(value)} style={[styles.option, cleanupRequired === value && styles.optionSelected]}><Text style={styles.optionText}>{value ? 'On' : 'Off'}</Text></Pressable>)}</View></View>;
}

const styles = StyleSheet.create({
  primaryButton: { alignItems: 'center', backgroundColor: '#2166D1', borderRadius: 12, minHeight: 52, justifyContent: 'center', paddingHorizontal: 20 },
  primaryButtonText: { color: '#FFFFFF', fontSize: 17, fontWeight: '700' },
  disabled: { backgroundColor: '#A8B8D9' }, pressed: { opacity: 0.82 },
  backButton: { alignSelf: 'flex-start', minHeight: 44, justifyContent: 'center', paddingHorizontal: 4 }, backButtonText: { color: '#2166D1', fontSize: 16, fontWeight: '600' },
  field: { gap: 6 }, label: { color: '#24242A', fontSize: 16, fontWeight: '600' },
  input: { borderColor: '#B8B8C2', borderRadius: 10, borderWidth: 1, color: '#1A1A1F', fontSize: 18, minHeight: 52, paddingHorizontal: 14 }, inputError: { borderColor: '#C62828' }, error: { color: '#C62828', minHeight: 18 },
  choiceGroup: { gap: 12 }, optionRow: { flexDirection: 'row', gap: 10 }, option: { alignItems: 'center', borderColor: '#B8B8C2', borderRadius: 10, borderWidth: 1, flex: 1, justifyContent: 'center', minHeight: 52 }, optionSelected: { borderColor: '#2166D1', backgroundColor: '#EAF1FF', borderWidth: 2 }, optionText: { color: '#24242A', fontSize: 16, fontWeight: '600' },
});
