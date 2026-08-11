import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { PipIcon } from "@/components/pip-icon";
import {
  ACCENT_COLORS,
  CHILD_AVATARS,
  findAccentColor,
  findChildAvatar,
} from "@/domain/child-avatars";
import { playmapTheme as theme } from "@/theme/playmap-theme";

/**
 * Child profile identity controls: the avatar badge and its two pickers.
 *
 * A badge is a drawn character on a pastel ground. Both the character and the
 * colour have spoken names, and both are rendered as text in the pickers, so a
 * child's identity is never carried by colour alone and nothing depends on
 * reading. No photograph of a child is stored anywhere.
 */

export function ProfileAvatar({
  avatarId,
  accentColorId,
  name,
  size = 56,
  /** Set when the surrounding control already names the child. */
  decorative = false,
}: {
  avatarId: string | null;
  accentColorId: string | null;
  name?: string;
  size?: number;
  decorative?: boolean;
}) {
  const avatar = findChildAvatar(avatarId);
  const accent = findAccentColor(accentColorId);
  const label = name ? `${name}, ${avatar.label} in ${accent.label}` : `${avatar.label} in ${accent.label}`;
  return (
    <View
      accessibilityElementsHidden={decorative}
      accessibilityLabel={decorative ? undefined : label}
      accessible={!decorative}
      importantForAccessibility={decorative ? "no-hide-descendants" : "yes"}
      style={[styles.avatar, { backgroundColor: accent.background, borderRadius: size / 2, height: size, width: size }]}
    >
      <PipIcon color={accent.foreground} name={avatar.character} size={Math.round(size * 0.62)} strokeWidth={1.5} />
    </View>
  );
}

export function AvatarPicker({
  value,
  onChange,
  accentColorId,
  label = "Badge",
}: {
  value: string;
  onChange: (avatarId: string) => void;
  accentColorId: string | null;
  label?: string;
}) {
  const selected = findChildAvatar(value);
  return (
    <View style={styles.pickerGroup}>
      <Text style={styles.pickerLabel}>{label}</Text>
      <ScrollView
        accessibilityRole="radiogroup"
        contentContainerStyle={styles.pickerRow}
        horizontal
        showsHorizontalScrollIndicator={false}
      >
        {CHILD_AVATARS.map((avatar) => {
          const isSelected = avatar.id === value;
          return (
            <Pressable
              accessibilityLabel={avatar.label}
              accessibilityRole="radio"
              accessibilityState={{ checked: isSelected, selected: isSelected }}
              key={avatar.id}
              onPress={() => onChange(avatar.id)}
              style={({ pressed }) => [styles.option, isSelected && styles.optionSelected, pressed && styles.pressed]}
            >
              <ProfileAvatar accentColorId={accentColorId} avatarId={avatar.id} decorative size={52} />
              {isSelected ? (
                <View style={styles.optionTick}>
                  <PipIcon color={theme.colors.brandPrimaryLabel} name="check" size={12} strokeWidth={3} />
                </View>
              ) : null}
            </Pressable>
          );
        })}
      </ScrollView>
      {/* The chosen character is said in words, so the tick is never the only signal. */}
      <Text accessibilityLiveRegion="polite" style={styles.pickerCaption}>{`Selected: ${selected.label}`}</Text>
    </View>
  );
}

export function AccentColorPicker({
  value,
  onChange,
  label = "Colour",
}: {
  value: string;
  onChange: (accentColorId: string) => void;
  label?: string;
}) {
  return (
    <View style={styles.pickerGroup}>
      <Text style={styles.pickerLabel}>{label}</Text>
      <View accessibilityRole="radiogroup" style={styles.swatchRow}>
        {ACCENT_COLORS.map((color) => {
          const selected = color.id === value;
          return (
            <Pressable
              accessibilityLabel={color.label}
              accessibilityRole="radio"
              accessibilityState={{ checked: selected, selected }}
              key={color.id}
              onPress={() => onChange(color.id)}
              style={({ pressed }) => [
                styles.swatch,
                { backgroundColor: color.background },
                selected && styles.swatchSelected,
                pressed && styles.pressed,
              ]}
            >
              {selected ? <PipIcon color={color.foreground} name="check" size={14} strokeWidth={2.8} /> : null}
              {/* The name is rendered, not just the fill, so the choice is never colour-only. */}
              <Text style={[styles.swatchLabel, { color: color.foreground }]}>{color.label}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  avatar: { alignItems: "center", justifyContent: "center" },
  pressed: { opacity: 0.72 },
  option: {
    alignItems: "center",
    borderColor: "transparent",
    borderRadius: theme.radii.pill,
    borderWidth: 2.5,
    justifyContent: "center",
    minHeight: theme.measurements.minimumTouchTarget,
    padding: 3,
  },
  optionSelected: { borderColor: theme.colors.brandInk },
  optionTick: {
    alignItems: "center",
    backgroundColor: theme.colors.brandPrimary,
    borderColor: theme.colors.background,
    borderRadius: theme.radii.pill,
    borderWidth: 2,
    bottom: 0,
    height: 22,
    justifyContent: "center",
    position: "absolute",
    right: 0,
    width: 22,
  },
  pickerGroup: { gap: 6 },
  pickerLabel: { color: theme.colors.primaryText, ...theme.typography.fieldLabel },
  pickerCaption: { color: theme.colors.secondaryText, ...theme.typography.meta },
  pickerRow: { gap: theme.spacing[8], paddingVertical: theme.spacing[4] },
  swatch: {
    alignItems: "center",
    borderColor: theme.colors.border,
    borderRadius: theme.radii.pill,
    borderWidth: 1,
    flexDirection: "row",
    gap: 5,
    justifyContent: "center",
    minHeight: theme.measurements.minimumTouchTarget,
    paddingHorizontal: theme.spacing[16],
  },
  swatchSelected: { borderColor: theme.colors.brandInk, borderWidth: 2.5 },
  swatchLabel: { ...theme.typography.label, fontSize: 14 },
  swatchRow: { flexDirection: "row", flexWrap: "wrap", gap: theme.spacing[8] },
});
