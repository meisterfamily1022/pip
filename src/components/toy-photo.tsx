import { useState } from 'react';
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { Image } from 'expo-image';

import { PipIcon } from '@/components/pip-icon';
import { resolveManagedToyImageUri } from '@/features/toys/toy-image-storage';
import { pipPhotoTiers, playmapTheme as theme, type ToyPhotoTier } from '@/theme/playmap-theme';

/**
 * A toy's own photograph.
 *
 * Pip's visual language is the family's real shelf, so wherever a toy is
 * represented its saved photo is the anchor. This is the single component that
 * draws one, which is what keeps crops, corner radii, loading behaviour and
 * screen-reader wording identical everywhere a toy appears.
 *
 * Rendering goes through `expo-image` rather than React Native's `Image` for
 * the memory-and-disk cache: a library scrolled twice should not re-decode the
 * same file off disk, and a child flicking between choices should not watch
 * photographs fade in again.
 *
 * When a toy has no photo the fallback is deliberately quiet — the toy's own
 * name, and its category if there is one. Never a cartoon, an emoji, or a
 * generated stand-in: an invented picture would misrepresent what the family
 * actually owns, which is the one thing this screen must get right.
 */
export type ToyPhotoProps = {
  uri?: string | null;
  /** The toy's real name. Used for the crop's accessible label. */
  name: string;
  /** Shown in the fallback when there is no photograph. */
  category?: string | null;
  tier?: ToyPhotoTier;
  /** Overrides the tier's aspect ratio, for a card that owns its own shape. */
  aspectRatio?: number;
  /** Set when the surrounding control already announces the toy. */
  decorative?: boolean;
  /** Dims the photo for a toy that cannot be chosen right now. */
  dimmed?: boolean;
  /**
   * Fills the parent instead of keeping the tier's aspect ratio. For cards that
   * already fix their own photo height — otherwise the ratio wins and the photo
   * sits square inside a wider frame with dead space beside it.
   */
  fill?: boolean;
  style?: StyleProp<ViewStyle>;
};

export function ToyPhoto({
  uri,
  name,
  category,
  tier = 'medium',
  aspectRatio,
  decorative = false,
  dimmed = false,
  fill = false,
  style,
}: ToyPhotoProps) {
  const [failed, setFailed] = useState(false);
  const shape = pipPhotoTiers[tier];
  const frame: ViewStyle = fill
    ? { borderRadius: 0, flex: 1, height: '100%', width: '100%' }
    : { aspectRatio: aspectRatio ?? shape.aspectRatio, borderRadius: shape.radius, minHeight: shape.minHeight };

  const hasPhoto = Boolean(uri) && !failed;
  const resolvedUri = uri ? resolveManagedToyImageUri(uri) : null;
  // The label names the toy either way, so a screen reader hears "Wooden train
  // set, photo" rather than the useless "image".
  const label = hasPhoto
    ? `${name}, photo`
    : failed
      ? `${name}, photo could not be loaded`
      : `${name}, no photo yet`;
  const accessibility = decorative
    ? { accessibilityElementsHidden: true, importantForAccessibility: 'no-hide-descendants' as const }
    : { accessible: true, accessibilityLabel: label, accessibilityRole: 'image' as const };

  if (hasPhoto) {
    return (
      <View {...accessibility} style={[styles.frame, frame, style]}>
        <Image
          accessibilityIgnoresInvertColors
          cachePolicy="memory-disk"
          contentFit="cover"
          onError={() => setFailed(true)}
          source={{ uri: resolvedUri ?? undefined }}
          style={[styles.fill, dimmed && styles.dimmed]}
          // A short cross-fade covers the disk read without drawing attention.
          transition={140}
        />
      </View>
    );
  }

  return (
    <View {...accessibility} style={[styles.frame, styles.fallback, frame, style]}>
      <PipIcon
        color={theme.colors.mutedText}
        name={failed ? 'alert' : 'photo-missing'}
        size={tier === 'small' ? 18 : 22}
      />
      {tier === 'small' ? null : (
        <View style={styles.fallbackCopy}>
          <Text numberOfLines={2} style={styles.fallbackName}>{name}</Text>
          {category ? <Text numberOfLines={1} style={styles.fallbackMeta}>{category}</Text> : null}
        </View>
      )}
    </View>
  );
}

/** One toy in a collage. Only toys that actually have a photo belong here. */
export type CollageToy = { id: number; name: string; imageUri: string | null };

/**
 * Several real toy photographs composed into one image.
 *
 * This is what makes "pick a toy" look like the child's own shelf instead of an
 * icon. It only ever draws photographs the family actually saved — the caller
 * filters to toys with images, and the layout adapts to however many there are
 * rather than padding the grid with placeholders.
 */
export function ToyPhotoCollage({
  toys,
  accessibilityLabel,
  style,
}: {
  toys: readonly CollageToy[];
  accessibilityLabel: string;
  style?: StyleProp<ViewStyle>;
}) {
  const shown = toys.slice(0, 4);
  if (shown.length === 0) return null;

  return (
    <View accessible accessibilityLabel={accessibilityLabel} accessibilityRole="image" style={[styles.collage, style]}>
      {shown.length === 1 ? (
        <ToyPhoto decorative fill name={shown[0].name} tier="hero" uri={shown[0].imageUri} />
      ) : (
        <>
          <View style={styles.collageColumn}>
            <ToyPhoto decorative fill name={shown[0].name} tier="medium" uri={shown[0].imageUri} />
            {shown[2] ? <ToyPhoto decorative fill name={shown[2].name} tier="medium" uri={shown[2].imageUri} /> : null}
          </View>
          <View style={styles.collageColumn}>
            <ToyPhoto decorative fill name={shown[1].name} tier="medium" uri={shown[1].imageUri} />
            {shown[3] ? <ToyPhoto decorative fill name={shown[3].name} tier="medium" uri={shown[3].imageUri} /> : null}
          </View>
        </>
      )}
    </View>
  );
}

/** How many of these toys have a photograph Pip can actually show. */
export function toysWithPhotos<T extends { imageUri: string | null }>(toys: readonly T[]): T[] {
  return toys.filter((toy) => Boolean(toy.imageUri));
}

const styles = StyleSheet.create({
  frame: { backgroundColor: theme.colors.photoFallback, overflow: 'hidden', width: '100%' },
  fill: { height: '100%', width: '100%' },
  dimmed: { opacity: 0.45 },
  fallback: { alignItems: 'center', gap: 6, justifyContent: 'center', padding: theme.spacing[12] },
  fallbackCopy: { alignItems: 'center', gap: 1 },
  fallbackName: { color: theme.colors.secondaryText, textAlign: 'center', ...theme.typography.label, fontSize: 13 },
  fallbackMeta: { color: theme.colors.mutedText, textAlign: 'center', ...theme.typography.caption },
  collage: {
    aspectRatio: pipPhotoTiers.hero.aspectRatio,
    backgroundColor: theme.colors.photoFallback,
    borderRadius: pipPhotoTiers.hero.radius,
    flexDirection: 'row',
    gap: 2,
    overflow: 'hidden',
    width: '100%',
  },
  collageColumn: { flex: 1, gap: 2 },
});
