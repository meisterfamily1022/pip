import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { PipIcon } from '@/components/pip-icon';
import type { ChildToy } from '@/repositories/toys-repository';
import { playmapTheme as theme } from '@/theme/playmap-theme';
import {
  ChildPrimaryButton,
  ChildSecondaryButton,
  PageShell,
  ToyImage as SharedToyImage,
} from './playmap-ui';

/**
 * Child Mode's chrome.
 *
 * Child Mode is recognisably Pip but plainly not the parent side: bigger type,
 * bigger targets, one thing to decide per screen, and exactly one way back.
 * There is no route to Parent Mode from here except the PIN.
 */

/** The single back control. Child Mode never shows more than one. */
export function ChildModeHeader({ backLabel = 'Home', onBack }: { backLabel?: string; onBack(): void }) {
  return (
    <View style={styles.header}>
      <Pressable
        accessibilityHint={`Returns to ${backLabel}`}
        accessibilityLabel={`Back to ${backLabel}`}
        accessibilityRole="button"
        onPress={onBack}
        style={({ pressed }) => [styles.backButton, pressed && styles.pressed]}
      >
        <PipIcon color={theme.colors.brandInk} name="chevron-left" size={22} />
        <Text maxFontSizeMultiplier={1.6} style={styles.backLabel}>{backLabel}</Text>
      </Pressable>
    </View>
  );
}

export function ChildButton({
  label,
  onPress,
  secondary = false,
  disabled = false,
  icon,
}: {
  label: string;
  onPress(): void;
  secondary?: boolean;
  disabled?: boolean;
  icon?: Parameters<typeof PipIcon>[0]['name'];
}) {
  const Button = secondary ? ChildSecondaryButton : ChildPrimaryButton;
  return <Button disabled={disabled} icon={icon} label={label} onPress={onPress} />;
}

export function ToyImage({ uri }: { uri: string | null }) {
  return <SharedToyImage accessibilityLabel="Toy photo" uri={uri} />;
}

export function ChildPage({
  children,
  centered = false,
  footer,
  footerPlain = false,
}: {
  children: ReactNode;
  centered?: boolean;
  footer?: ReactNode;
  /** For a quiet bottom link, such as the way out to Parent Mode. */
  footerPlain?: boolean;
}) {
  return (
    <PageShell child contentStyle={centered ? styles.centered : undefined} footer={footer} footerPlain={footerPlain}>
      {children}
    </PageShell>
  );
}

/** Where the toy lives, said the way a child would be told it. */
export function LocationPanel({ room, spot }: { room: string; spot: string }) {
  return (
    <View accessibilityLabel={`Look on the ${spot} in the ${room}`} accessible style={styles.locationPanel}>
      <PipIcon color={theme.colors.brandInk} name="spaces" size={22} />
      <Text style={styles.locationValue}>
        {'Look on the '}
        <Text style={styles.locationStrong}>{spot}</Text>
        {' in the '}
        <Text style={styles.locationStrong}>{room}</Text>
      </Text>
    </View>
  );
}

export function ChildLink({ label, onPress }: { label: string; onPress(): void }) {
  return (
    <Pressable accessibilityLabel={label} accessibilityRole="button" onPress={onPress} style={({ pressed }) => [styles.link, pressed && styles.pressed]}>
      <Text style={styles.linkText}>{label}</Text>
    </Pressable>
  );
}

/** A toy offered as one of the choices. Unavailable toys say who has them. */
export function ToyCard({
  toy,
  onPress,
  unavailableBecause,
  showName = true,
  onSpeak,
}: {
  toy: ChildToy;
  onPress(): void;
  /** The child currently playing with it, when it cannot be chosen. */
  unavailableBecause?: string | null;
  /** False in pictures-only mode, where the photo carries the whole message. */
  showName?: boolean;
  /** Present in spoken-label mode. */
  onSpeak?(): void;
}) {
  const unavailable = Boolean(unavailableBecause);
  const label = unavailable
    ? `${toy.name}. ${unavailableBecause} has this one.`
    : `${toy.name}. In the ${toy.roomName}, ${toy.storageSpotName}.`;
  return (
    <View style={[styles.card, unavailable && styles.cardUnavailable]}>
      <Pressable
        accessibilityHint={unavailable ? undefined : 'Choose this toy'}
        accessibilityLabel={label}
        accessibilityRole="button"
        accessibilityState={{ disabled: unavailable }}
        disabled={unavailable}
        onPress={onPress}
        style={({ pressed }) => [styles.cardPress, pressed && !unavailable && styles.pressed]}
      >
        <View style={[styles.cardPhoto, unavailable && styles.dimmed]}>
          <ToyImage uri={toy.imageUri} />
        </View>
        {showName ? <Text numberOfLines={2} style={styles.toyName}>{toy.name}</Text> : null}
        <Text numberOfLines={2} style={styles.location}>
          {unavailable ? `${unavailableBecause} has this one` : `${toy.roomName} · ${toy.storageSpotName}`}
        </Text>
      </Pressable>
      {onSpeak && !unavailable ? (
        <Pressable
          accessibilityLabel={`Say the name, ${toy.name}`}
          accessibilityRole="button"
          onPress={onSpeak}
          style={({ pressed }) => [styles.speakButton, pressed && styles.pressed]}
        >
          <PipIcon color={theme.colors.brandInk} name="speaker" size={20} />
          <Text style={styles.speakLabel}>Say the name</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  pressed: { opacity: 0.72 },
  dimmed: { opacity: 0.45 },
  header: { flexDirection: 'row', minHeight: theme.measurements.minimumTouchTarget },
  backButton: { alignItems: 'center', flexDirection: 'row', gap: 2, minHeight: theme.measurements.minimumTouchTarget, paddingRight: theme.spacing[8] },
  backLabel: { color: theme.colors.brandInk, ...theme.typography.rowTitle },
  centered: { flexGrow: 1, justifyContent: 'center' },
  card: {
    backgroundColor: theme.colors.cardSurface,
    borderColor: theme.colors.border,
    borderRadius: theme.radii.sheet,
    borderWidth: 1,
    overflow: 'hidden',
  },
  cardUnavailable: { backgroundColor: theme.colors.mutedSurface, borderColor: theme.colors.mutedBorder },
  cardPress: { gap: 4, paddingBottom: theme.spacing[12] },
  cardPhoto: { backgroundColor: theme.colors.photoFallback, width: '100%' },
  toyName: { color: theme.colors.primaryText, paddingHorizontal: theme.spacing[12], paddingTop: theme.spacing[8], ...theme.typography.sectionTitle },
  location: { color: theme.colors.secondaryText, paddingHorizontal: theme.spacing[12], ...theme.typography.meta },
  speakButton: {
    alignItems: 'center',
    borderTopColor: theme.colors.divider,
    borderTopWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    gap: theme.spacing[8],
    justifyContent: 'center',
    minHeight: theme.measurements.minimumTouchTarget,
  },
  speakLabel: { color: theme.colors.brandInk, ...theme.typography.label, fontSize: 14 },
  locationPanel: {
    alignItems: 'center',
    backgroundColor: theme.colors.cardSurface,
    borderColor: theme.colors.border,
    borderRadius: theme.radii.card,
    borderWidth: 1,
    flexDirection: 'row',
    gap: theme.spacing[12],
    padding: theme.spacing[16],
    width: '100%',
  },
  locationValue: { color: theme.colors.primaryText, flex: 1, ...theme.typography.body, fontSize: 18, lineHeight: 26 },
  locationStrong: { fontFamily: theme.fonts.bold },
  link: { alignItems: 'center', justifyContent: 'center', minHeight: theme.measurements.minimumTouchTarget, paddingHorizontal: theme.spacing[12] },
  linkText: { color: theme.colors.brandInk, ...theme.typography.label },
});
