import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import {
  ACCENT_COLORS,
  CHILD_AVATARS,
  findAccentColor,
  findChildAvatar,
  type AvatarMotif,
  type AvatarShape,
} from "@/domain/child-avatars";
import { playmapTheme as theme } from "@/theme/playmap-theme";

/**
 * Child profile identity controls: the avatar badge and the two pickers.
 *
 * Avatars are geometry, not artwork, so nothing depends on new image assets
 * and no photograph of a child is ever stored.
 */

function shapeStyle(shape: AvatarShape, size: number) {
  switch (shape) {
    case "circle":
      return { borderRadius: size / 2 };
    case "rounded":
      return { borderRadius: size * 0.28 };
    case "arch":
      return { borderTopLeftRadius: size / 2, borderTopRightRadius: size / 2, borderBottomLeftRadius: size * 0.22, borderBottomRightRadius: size * 0.22 };
    case "petal":
      return { borderTopLeftRadius: size / 2, borderBottomRightRadius: size / 2, borderTopRightRadius: size * 0.22, borderBottomLeftRadius: size * 0.22 };
  }
}

function Motif({ motif, size, color }: { motif: AvatarMotif; size: number; color: string }) {
  const unit = size * 0.16;
  switch (motif) {
    case "dot":
      return <View style={{ backgroundColor: color, borderRadius: unit, height: unit * 2, width: unit * 2 }} />;
    case "ring":
      return (
        <View
          style={{
            borderColor: color,
            borderRadius: unit * 1.6,
            borderWidth: Math.max(2, unit * 0.5),
            height: unit * 3.2,
            width: unit * 3.2,
          }}
        />
      );
    case "bar":
      return <View style={{ backgroundColor: color, borderRadius: unit / 2, height: unit, width: unit * 3.4 }} />;
    case "pair":
      return (
        <View style={{ flexDirection: "row", gap: unit * 0.8 }}>
          <View style={{ backgroundColor: color, borderRadius: unit, height: unit * 1.6, width: unit * 1.6 }} />
          <View style={{ backgroundColor: color, borderRadius: unit, height: unit * 1.6, width: unit * 1.6 }} />
        </View>
      );
    case "cross":
      return (
        <View style={{ alignItems: "center", height: unit * 3.2, justifyContent: "center", width: unit * 3.2 }}>
          <View style={{ backgroundColor: color, borderRadius: unit / 2, height: unit * 0.9, position: "absolute", width: unit * 3.2 }} />
          <View style={{ backgroundColor: color, borderRadius: unit / 2, height: unit * 3.2, position: "absolute", width: unit * 0.9 }} />
        </View>
      );
    case "corner":
      return (
        <View style={{ height: unit * 3, width: unit * 3 }}>
          <View style={{ backgroundColor: color, borderRadius: unit / 2, height: unit * 0.9, width: unit * 3 }} />
          <View style={{ backgroundColor: color, borderRadius: unit / 2, height: unit * 2.1, marginTop: unit * 0.4, width: unit * 0.9 }} />
        </View>
      );
  }
}

/**
 * A child's avatar badge. `name` is only used to build the spoken label, so a
 * screen reader announces who the badge belongs to rather than "image".
 */
export function ProfileAvatar({
  avatarId,
  accentColorId,
  name,
  size = 64,
}: {
  avatarId: string | null;
  accentColorId: string | null;
  name?: string;
  size?: number;
}) {
  const avatar = findChildAvatar(avatarId);
  const accent = findAccentColor(accentColorId);
  return (
    <View
      accessibilityLabel={name ? `${name}, ${avatar.label} in ${accent.label}` : `${avatar.label} in ${accent.label}`}
      accessible
      style={[
        styles.avatar,
        shapeStyle(avatar.shape, size),
        { backgroundColor: accent.background, height: size, width: size },
      ]}
    >
      <Motif color={accent.foreground} motif={avatar.motif} size={size} />
    </View>
  );
}

export function AvatarPicker({
  value,
  onChange,
  accentColorId,
  label = "Choose an avatar",
}: {
  value: string;
  onChange: (avatarId: string) => void;
  accentColorId: string | null;
  label?: string;
}) {
  return (
    <View style={styles.pickerGroup}>
      <Text style={styles.pickerLabel}>{label}</Text>
      <ScrollView contentContainerStyle={styles.pickerRow} horizontal showsHorizontalScrollIndicator={false}>
        {CHILD_AVATARS.map((avatar) => {
          const selected = avatar.id === value;
          return (
            <Pressable
              accessibilityLabel={avatar.label}
              accessibilityRole="radio"
              accessibilityState={{ checked: selected, selected }}
              key={avatar.id}
              onPress={() => onChange(avatar.id)}
              style={[styles.option, selected && styles.optionSelected]}
            >
              <ProfileAvatar accentColorId={accentColorId} avatarId={avatar.id} size={56} />
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

export function AccentColorPicker({
  value,
  onChange,
  label = "Choose a color",
}: {
  value: string;
  onChange: (accentColorId: string) => void;
  label?: string;
}) {
  return (
    <View style={styles.pickerGroup}>
      <Text style={styles.pickerLabel}>{label}</Text>
      <View style={styles.swatchRow}>
        {ACCENT_COLORS.map((color) => {
          const selected = color.id === value;
          return (
            <Pressable
              accessibilityLabel={color.label}
              accessibilityRole="radio"
              accessibilityState={{ checked: selected, selected }}
              key={color.id}
              onPress={() => onChange(color.id)}
              style={[styles.swatch, selected && styles.optionSelected, { backgroundColor: color.background }]}
            >
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
  option: {
    alignItems: "center",
    borderColor: "transparent",
    borderRadius: theme.radii.large,
    borderWidth: 3,
    justifyContent: "center",
    minHeight: theme.measurements.minimumTouchTarget,
    padding: theme.spacing[4],
  },
  optionSelected: { borderColor: theme.colors.brandInk },
  pickerGroup: { gap: theme.spacing[8] },
  pickerLabel: { color: theme.colors.primaryText, ...theme.typography.label },
  pickerRow: { gap: theme.spacing[12], paddingVertical: theme.spacing[4] },
  swatch: {
    alignItems: "center",
    borderColor: "transparent",
    borderRadius: theme.radii.pill,
    borderWidth: 3,
    justifyContent: "center",
    minHeight: theme.measurements.minimumTouchTarget,
    paddingHorizontal: theme.spacing[16],
  },
  swatchLabel: { ...theme.typography.label },
  swatchRow: { flexDirection: "row", flexWrap: "wrap", gap: theme.spacing[8] },
});
