import { StyleSheet, Text, View } from 'react-native';

import type { ChoiceLimit } from '@/domain/models';
import { SelectPill, ToggleRow } from '@/design/primitives';
import { colors, fontSizes, spacing } from '@/design/tokens';

const CHOICE_LIMITS: readonly ChoiceLimit[] = [1, 3, 5];

const choiceLimitLabel = (value: ChoiceLimit): string => `${value} ${value === 1 ? 'toy' : 'toys'}`;

type ChoiceControlsProps = {
  choiceLimit: ChoiceLimit;
  onChoiceLimitChange(value: ChoiceLimit): void;
  cleanupRequired: boolean;
  onCleanupRequiredChange(value: boolean): void;
};

/**
 * The Child Mode options collected during setup, worded to match Settings so a
 * parent recognises them again later.
 */
export function ChoiceControls({
  choiceLimit,
  onChoiceLimitChange,
  cleanupRequired,
  onCleanupRequiredChange,
}: ChoiceControlsProps) {
  return (
    <View style={styles.group}>
      <View style={styles.field}>
        <Text style={styles.label}>Choice limit</Text>
        <View accessibilityRole="radiogroup" style={styles.pillRow}>
          {CHOICE_LIMITS.map((value) => (
            <SelectPill
              key={value}
              label={choiceLimitLabel(value)}
              onPress={() => onChoiceLimitChange(value)}
              selected={choiceLimit === value}
            />
          ))}
        </View>
      </View>
      <ToggleRow
        description="Ask for cleanup before another toy choice."
        onValueChange={onCleanupRequiredChange}
        title="Cleanup required"
        value={cleanupRequired}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  field: { gap: spacing.sm },
  group: { gap: spacing.xl },
  label: { color: colors.textPrimary, fontSize: fontSizes.label, fontWeight: '700' },
  pillRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
});
