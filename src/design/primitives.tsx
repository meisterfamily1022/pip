import type { PropsWithChildren, ReactNode } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';

import { CheckIcon, ChevronLeftIcon, ChevronRightIcon, LocationArrowIcon, ModeDiamondIcon, type IconProps } from './icons';
import { MIN_TOUCH_TARGET, accentShadow, cardShadow, colors, fontSizes, fonts, radii, spacing } from './tokens';

/**
 * Shared UI primitives for the PlayMap redesign.
 *
 * Screens compose these rather than restyling raw React Native views, so the
 * two modes stay visually consistent. Parent Mode sits on a warm cream page and
 * Child Mode on a cool mint page; pass `mode` to `Screen` to pick one.
 */

export type Mode = 'parent' | 'child';

/** Soft tint fills that cards and tiles rotate through. */
export type Tint = 'sage' | 'mint' | 'butter' | 'peach' | 'lilac';

const tintFill: Record<Tint, string> = {
  sage: colors.sage,
  mint: colors.mint,
  butter: colors.butter,
  peach: colors.peach,
  lilac: colors.lilac,
};

/** Foreground that stays legible on each tint. */
const tintForeground: Record<Tint, string> = {
  sage: colors.green,
  mint: colors.greenDeep,
  butter: colors.amberDeep,
  peach: colors.terracotta,
  lilac: colors.purpleDeep,
};

/** Translucent icon-well fill matching each tint's foreground. */
const tintWell: Record<Tint, string> = {
  sage: 'rgba(94,143,126,0.18)',
  mint: 'rgba(63,115,99,0.16)',
  butter: 'rgba(122,90,22,0.14)',
  peach: 'rgba(169,79,63,0.16)',
  lilac: 'rgba(91,74,120,0.14)',
};

export function tintColors(tint: Tint): { fill: string; foreground: string; well: string } {
  return { fill: tintFill[tint], foreground: tintForeground[tint], well: tintWell[tint] };
}

/* ------------------------------------------------------------------ layout */

type ScreenProps = PropsWithChildren<{
  mode: Mode;
  /** Pinned below the scroll area — use for a single primary action. */
  footer?: ReactNode;
  /** Set false for screens that manage their own scrolling (e.g. a grid). */
  scroll?: boolean;
  contentStyle?: StyleProp<ViewStyle>;
}>;

/**
 * Page chrome: safe area, mode background, keyboard avoidance and a centred
 * column that stops widening on iPad.
 */
export function Screen({ mode, footer, scroll = true, contentStyle, children }: ScreenProps) {
  const background = mode === 'parent' ? colors.pageParent : colors.pageChild;
  const body = <View style={[styles.column, contentStyle]}>{children}</View>;
  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={[styles.screen, { backgroundColor: background }]}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.flex}>
        {scroll ? (
          <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
            {body}
          </ScrollView>
        ) : (
          <View style={styles.flex}>{body}</View>
        )}
        {footer ? <View style={[styles.footer, { backgroundColor: background }]}>{footer}</View> : null}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

/* ------------------------------------------------------------------- text */

export function ScreenTitle({ children, style }: PropsWithChildren<{ style?: StyleProp<TextStyle> }>) {
  return (
    <Text accessibilityRole="header" style={[styles.screenTitle, style]}>
      {children}
    </Text>
  );
}

export function DisplayTitle({ children }: PropsWithChildren) {
  return (
    <Text accessibilityRole="header" style={styles.displayTitle}>
      {children}
    </Text>
  );
}

export function SectionTitle({ children }: PropsWithChildren) {
  return <Text style={styles.sectionTitle}>{children}</Text>;
}

export function Body({ children, style }: PropsWithChildren<{ style?: StyleProp<TextStyle> }>) {
  return <Text style={[styles.body, style]}>{children}</Text>;
}

export function Caption({ children }: PropsWithChildren) {
  return <Text style={styles.caption}>{children}</Text>;
}

/** Announces validation and save failures to screen readers as they appear. */
export function ErrorText({ children }: PropsWithChildren) {
  return (
    <Text accessibilityLiveRegion="polite" style={styles.errorText}>
      {children}
    </Text>
  );
}

/** Confirmation line, e.g. "✓ Playroom added". */
export function SuccessText({ children }: PropsWithChildren) {
  return (
    <Text accessibilityLiveRegion="polite" style={styles.successText}>
      {children}
    </Text>
  );
}

/* ------------------------------------------------------------------ chrome */

export function ModeBadge({ mode }: { mode: Mode }) {
  return (
    <View style={styles.modeBadge}>
      <ModeDiamondIcon size={9} color={colors.terracotta} />
      <Text style={styles.modeBadgeText}>{mode === 'parent' ? 'PARENT MODE' : 'CHILD MODE'}</Text>
    </View>
  );
}

/** Small uppercase eyebrow above a heading, e.g. "CHOOSE A PLAY TYPE". */
export function Eyebrow({ children }: PropsWithChildren) {
  return <Text style={styles.eyebrow}>{children}</Text>;
}

/** Parent Mode back affordance: a green text link with a chevron. */
export function BackLink({ label, onPress }: { label: string; onPress(): void }) {
  return (
    <Pressable
      accessibilityLabel={`Back to ${label}`}
      accessibilityRole="button"
      hitSlop={8}
      onPress={onPress}
      style={({ pressed }) => [styles.backLink, pressed && styles.pressed]}
    >
      <ChevronLeftIcon size={26} color={colors.green} />
      <Text style={styles.backLinkText}>{label}</Text>
    </Pressable>
  );
}

/** Child Mode back affordance: a large mint pill that is easy to hit. */
export function BackPill({ label, onPress }: { label: string; onPress(): void }) {
  return (
    <Pressable
      accessibilityLabel={`Back to ${label}`}
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.backPill, pressed && styles.pressed]}
    >
      <ChevronLeftIcon size={20} color={colors.textPrimary} />
      <Text style={styles.backPillText}>{label}</Text>
    </Pressable>
  );
}

/* ----------------------------------------------------------------- surfaces */

export function Card({ children, style }: PropsWithChildren<{ style?: StyleProp<ViewStyle> }>) {
  return <View style={[styles.card, style]}>{children}</View>;
}

/** Flat tinted panel used to group form sections. */
export function TintPanel({ tint, children, style }: PropsWithChildren<{ tint: Tint; style?: StyleProp<ViewStyle> }>) {
  return <View style={[styles.tintPanel, { backgroundColor: tintFill[tint] }, style]}>{children}</View>;
}

/** Rounded square that holds an icon inside a card or tile. */
export function IconWell({
  tint,
  size = 52,
  style,
  children,
}: PropsWithChildren<{ tint: Tint; size?: number; style?: StyleProp<ViewStyle> }>) {
  return (
    <View
      style={[
        styles.iconWell,
        { backgroundColor: tintWell[tint], width: size, height: size, borderRadius: size * 0.31 },
        style,
      ]}
    >
      {children}
    </View>
  );
}

type HeroCardProps = PropsWithChildren<{ colors: readonly [string, string]; style?: StyleProp<ViewStyle> }>;

/** Gradient band used at the top of Parent Home and Child Home. */
export function HeroCard({ colors: gradient, style, children }: HeroCardProps) {
  return (
    <LinearGradient colors={gradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[styles.hero, style]}>
      {children}
    </LinearGradient>
  );
}

/* ------------------------------------------------------------------ actions */

type NavCardProps = {
  title: string;
  subtitle: string;
  tint: Tint;
  icon: (props: IconProps) => React.JSX.Element;
  onPress(): void;
};

/** The large tappable row used for primary navigation on both home screens. */
export function NavCard({ title, subtitle, tint, icon: IconComponent, onPress }: NavCardProps) {
  const { fill, foreground } = tintColors(tint);
  return (
    <Pressable
      accessibilityHint={subtitle}
      accessibilityLabel={title}
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.navCard, { backgroundColor: fill }, pressed && styles.pressedCard]}
    >
      <IconWell tint={tint}>
        <IconComponent size={26} color={foreground} />
      </IconWell>
      <View style={styles.navCardText}>
        <Text style={styles.navCardTitle}>{title}</Text>
        <Text style={styles.navCardSubtitle}>{subtitle}</Text>
      </View>
      <ChevronRightIcon size={22} color={colors.textSecondary} />
    </Pressable>
  );
}

type TileProps = {
  label: string;
  tint: Tint;
  icon: (props: IconProps) => React.JSX.Element;
  onPress(): void;
  style?: StyleProp<ViewStyle>;
};

/** Category tile in Child Mode: icon, label, chevron. */
export function CategoryTile({ label, tint, icon: IconComponent, onPress, style }: TileProps) {
  const { fill, foreground } = tintColors(tint);
  return (
    <Pressable
      accessibilityLabel={label}
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.categoryTile, { backgroundColor: fill }, pressed && styles.pressedCard, style]}
    >
      <IconComponent size={26} color={foreground} />
      <Text style={styles.categoryLabel}>{label}</Text>
      <ChevronRightIcon size={20} color={colors.textSecondary} />
    </Pressable>
  );
}

type ButtonProps = {
  label: string;
  onPress(): void;
  disabled?: boolean;
  accessibilityLabel?: string;
  icon?: (props: IconProps) => React.JSX.Element;
  style?: StyleProp<ViewStyle>;
};

/** Terracotta filled action. One per screen. */
export function PrimaryButton({ label, onPress, disabled = false, accessibilityLabel, icon: IconComponent, style }: ButtonProps) {
  return (
    <Pressable
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.primaryButton,
        disabled ? styles.primaryButtonDisabled : accentShadow,
        pressed && !disabled && styles.pressed,
        style,
      ]}
    >
      {IconComponent ? <IconComponent size={18} color={disabled ? colors.disabledText : colors.textOnAccent} /> : null}
      <Text style={[styles.primaryButtonText, disabled && styles.disabledText]}>{label}</Text>
    </Pressable>
  );
}

/** Green filled action, used for calm confirmations in Child Mode. */
export function ConfirmButton({ label, onPress, disabled = false, accessibilityLabel, style }: ButtonProps) {
  return (
    <Pressable
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.confirmButton,
        disabled && styles.primaryButtonDisabled,
        pressed && !disabled && styles.pressed,
        style,
      ]}
    >
      <Text style={[styles.primaryButtonText, disabled && styles.disabledText]}>{label}</Text>
    </Pressable>
  );
}

/** Outlined action on a surface background. */
export function SecondaryButton({ label, onPress, disabled = false, accessibilityLabel, icon: IconComponent, style }: ButtonProps) {
  return (
    <Pressable
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [styles.secondaryButton, pressed && !disabled && styles.pressed, style]}
    >
      {IconComponent ? <IconComponent size={16} color={colors.textPrimary} /> : null}
      <Text style={styles.secondaryButtonText}>{label}</Text>
    </Pressable>
  );
}

/** Outlined destructive action. */
export function DangerButton({ label, onPress, accessibilityLabel, icon: IconComponent, style }: ButtonProps) {
  return (
    <Pressable
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.dangerButton, pressed && styles.pressed, style]}
    >
      {IconComponent ? <IconComponent size={16} color={colors.danger} /> : null}
      <Text style={styles.dangerButtonText}>{label}</Text>
    </Pressable>
  );
}

/** Soft sage pill used for inline row actions (Edit, Add storage spot). */
export function QuietButton({ label, onPress, accessibilityLabel, icon: IconComponent, style }: ButtonProps) {
  return (
    <Pressable
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.quietButton, pressed && styles.pressed, style]}
    >
      {IconComponent ? <IconComponent size={15} color={colors.textPrimary} /> : null}
      <Text style={styles.quietButtonText}>{label}</Text>
    </Pressable>
  );
}

/** Underlined text button, e.g. "Grown-up area". */
export function TextLink({ label, onPress }: { label: string; onPress(): void }) {
  return (
    <Pressable
      accessibilityLabel={label}
      accessibilityRole="button"
      hitSlop={10}
      onPress={onPress}
      style={({ pressed }) => [styles.textLink, pressed && styles.pressed]}
    >
      <Text style={styles.textLinkText}>{label}</Text>
    </Pressable>
  );
}

type SelectPillProps = {
  label: string;
  selected: boolean;
  onPress(): void;
  accessibilityLabel?: string;
  /** 'radio' for mutually exclusive options, 'checkbox' for multi-select. */
  role?: 'radio' | 'checkbox';
};

/** Selectable pill for choice limits, category filters and tag pickers. */
export function SelectPill({ label, selected, onPress, accessibilityLabel, role = 'radio' }: SelectPillProps) {
  return (
    <Pressable
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityRole={role}
      accessibilityState={{ selected, checked: selected }}
      onPress={onPress}
      style={({ pressed }) => [styles.selectPill, selected && styles.selectPillSelected, pressed && styles.pressed]}
    >
      {selected ? <CheckIcon size={15} color={colors.green} /> : null}
      <Text style={[styles.selectPillText, selected && styles.selectPillTextSelected]}>{label}</Text>
    </Pressable>
  );
}

/** Read-only category chip shown on a toy card. */
export function Tag({ label }: { label: string }) {
  return (
    <View style={styles.tag}>
      <Text style={styles.tagText}>{label}</Text>
    </View>
  );
}

/* -------------------------------------------------------------------- forms */

type TextFieldProps = {
  label: string;
  value: string;
  onChangeText(value: string): void;
  placeholder?: string;
  error?: string | null;
  helper?: string;
  keyboardType?: 'default' | 'number-pad';
  secureTextEntry?: boolean;
  maxLength?: number;
  editable?: boolean;
  autoFocus?: boolean;
};

export function TextField({
  label,
  value,
  onChangeText,
  placeholder,
  error,
  helper,
  keyboardType,
  secureTextEntry,
  maxLength,
  editable = true,
  autoFocus,
}: TextFieldProps) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        accessibilityLabel={label}
        autoFocus={autoFocus}
        editable={editable}
        keyboardType={keyboardType}
        maxLength={maxLength}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.textSecondary}
        secureTextEntry={secureTextEntry}
        style={[styles.input, !editable && styles.inputDisabled, Boolean(error) && styles.inputError]}
        value={value}
      />
      {helper && !error ? <Text style={styles.helperText}>{helper}</Text> : null}
      {error ? <ErrorText>{error}</ErrorText> : null}
    </View>
  );
}

type ToggleRowProps = {
  title: string;
  description: string;
  value: boolean;
  onValueChange(value: boolean): void;
};

/** Switch row matching the design's track-and-knob toggle. */
export function ToggleRow({ title, description, value, onValueChange }: ToggleRowProps) {
  return (
    <Pressable
      accessibilityHint={description}
      accessibilityLabel={title}
      accessibilityRole="switch"
      accessibilityState={{ checked: value }}
      onPress={() => onValueChange(!value)}
      style={({ pressed }) => [styles.toggleRow, pressed && styles.pressed]}
    >
      <View style={styles.toggleText}>
        <Text style={styles.toggleTitle}>{title}</Text>
        <Text style={styles.toggleDescription}>{description}</Text>
      </View>
      <View style={[styles.toggleTrack, { backgroundColor: value ? colors.green : colors.disabledBackground }]}>
        <View style={[styles.toggleKnob, { left: value ? 24 : 3 }]} />
      </View>
    </Pressable>
  );
}

/* --------------------------------------------------------------- composites */

/**
 * "Playroom → Blue Bin" with the design's arrow glyph.
 *
 * `prominent` is the Child Mode reveal treatment: serif, full size and in the
 * primary text colour, because that screen's whole job is telling the child
 * where the toy lives.
 */
export function LocationLine({ label, size = 'default' }: { label: string; size?: 'default' | 'small' | 'prominent' }) {
  const iconSize = size === 'small' ? 12 : size === 'prominent' ? 22 : 15;
  return (
    <View style={styles.locationLine}>
      <LocationArrowIcon size={iconSize} color={size === 'prominent' ? colors.greenDeep : colors.textSecondary} />
      <Text
        style={[
          styles.locationText,
          size === 'small' && styles.locationTextSmall,
          size === 'prominent' && styles.locationTextProminent,
        ]}
      >
        {label}
      </Text>
    </View>
  );
}

/** Renders a room and storage spot as the design's "Room → Spot" string. */
export function locationLabel(roomName: string, storageSpotName: string): string {
  return `${roomName} → ${storageSpotName}`;
}

type EmptyStateProps = {
  title: string;
  description?: string;
  icon: (props: IconProps) => React.JSX.Element;
  action?: ReactNode;
};

export function EmptyState({ title, description, icon: IconComponent, action }: EmptyStateProps) {
  return (
    <View style={styles.emptyState}>
      <View style={styles.emptyIcon}>
        <IconComponent size={42} color={colors.green} />
      </View>
      <Text accessibilityRole="header" style={styles.emptyTitle}>
        {title}
      </Text>
      {description ? <Text style={styles.emptyDescription}>{description}</Text> : null}
      {action}
    </View>
  );
}

export function LoadingState({ label }: { label: string }) {
  return (
    <View style={styles.centered}>
      <Text accessibilityLiveRegion="polite" style={styles.body}>
        {label}
      </Text>
    </View>
  );
}

export function ErrorState({ title, message, onRetry }: { title?: string; message: string; onRetry(): void }) {
  return (
    <View style={styles.centered}>
      {title ? (
        <Text accessibilityRole="header" style={styles.emptyTitle}>
          {title}
        </Text>
      ) : null}
      <ErrorText>{message}</ErrorText>
      <SecondaryButton label="Try again" onPress={onRetry} />
    </View>
  );
}

/* ------------------------------------------------------------------ styles */

const styles = StyleSheet.create({
  flex: { flex: 1 },
  screen: { flex: 1 },
  scrollContent: { flexGrow: 1, paddingBottom: 48 },
  column: { alignSelf: 'center', maxWidth: 960, padding: spacing.xxl, paddingTop: spacing.xxxl, width: '100%' },
  footer: { borderTopColor: colors.border, borderTopWidth: 1, padding: spacing.lg },

  screenTitle: { color: colors.textPrimary, fontFamily: fonts.heading, fontSize: fontSizes.title, fontWeight: '700', lineHeight: 40 },
  displayTitle: { color: colors.textPrimary, fontFamily: fonts.heading, fontSize: fontSizes.display, fontWeight: '700', lineHeight: 44 },
  sectionTitle: { color: colors.textPrimary, fontFamily: fonts.heading, fontSize: fontSizes.sectionTitle, fontWeight: '700' },
  body: { color: colors.textSecondary, fontSize: fontSizes.body, lineHeight: 24 },
  caption: { color: colors.textSecondary, fontSize: fontSizes.caption, lineHeight: 19 },
  errorText: { color: colors.danger, fontSize: fontSizes.label, fontWeight: '700', lineHeight: 20 },
  successText: { color: colors.greenConfirm, fontSize: fontSizes.label, fontWeight: '700', lineHeight: 20 },

  modeBadge: { alignItems: 'center', flexDirection: 'row', gap: 6 },
  modeBadgeText: { color: colors.terracotta, fontSize: fontSizes.badge, fontWeight: '800', letterSpacing: 1.6 },
  eyebrow: { color: colors.terracotta, fontSize: fontSizes.badge, fontWeight: '800', letterSpacing: 1.6 },

  backLink: { alignItems: 'center', alignSelf: 'flex-start', flexDirection: 'row', minHeight: MIN_TOUCH_TARGET },
  backLinkText: { color: colors.green, fontSize: fontSizes.body, fontWeight: '700' },
  backPill: {
    alignItems: 'center', alignSelf: 'flex-start', backgroundColor: colors.mint, borderRadius: radii.pill,
    flexDirection: 'row', gap: 6, minHeight: MIN_TOUCH_TARGET, paddingHorizontal: 18,
  },
  backPillText: { color: colors.textPrimary, fontSize: fontSizes.body, fontWeight: '800' },

  card: {
    backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radii.card, borderWidth: 1,
    padding: spacing.xxl, ...cardShadow,
  },
  tintPanel: { borderRadius: radii.card, padding: 26 },
  iconWell: { alignItems: 'center', justifyContent: 'center' },
  hero: {
    borderRadius: radii.hero, padding: 28,
    shadowColor: colors.terracotta, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.1, shadowRadius: 20, elevation: 2,
  },

  navCard: {
    alignItems: 'center', borderRadius: radii.card, flexDirection: 'row', gap: 18, minHeight: 96,
    paddingHorizontal: 26, paddingVertical: 22, ...cardShadow,
  },
  navCardText: { flex: 1, gap: 2 },
  navCardTitle: { color: colors.textPrimary, fontFamily: fonts.heading, fontSize: fontSizes.cardTitle, fontWeight: '700' },
  navCardSubtitle: { color: colors.textSecondary, fontSize: fontSizes.label },

  categoryTile: { alignItems: 'center', borderRadius: radii.tile, flexDirection: 'row', gap: 14, minHeight: 72, padding: spacing.xl },
  categoryLabel: { color: colors.textPrimary, flex: 1, fontFamily: fonts.heading, fontSize: fontSizes.sectionTitle, fontWeight: '700' },

  primaryButton: {
    alignItems: 'center', backgroundColor: colors.terracotta, borderRadius: radii.control, flexDirection: 'row',
    gap: spacing.sm, justifyContent: 'center', minHeight: 52, paddingHorizontal: 22, paddingVertical: spacing.lg,
  },
  primaryButtonDisabled: { backgroundColor: colors.disabledBackground },
  primaryButtonText: { color: colors.textOnAccent, fontSize: 17, fontWeight: '700' },
  disabledText: { color: colors.disabledText },
  confirmButton: {
    alignItems: 'center', backgroundColor: colors.green, borderRadius: radii.action, justifyContent: 'center',
    minHeight: 52, paddingHorizontal: 30, paddingVertical: spacing.lg,
  },
  secondaryButton: {
    alignItems: 'center', backgroundColor: colors.surface, borderColor: colors.textPrimary, borderRadius: radii.control,
    borderWidth: 1.5, flexDirection: 'row', gap: 6, justifyContent: 'center', minHeight: MIN_TOUCH_TARGET, paddingHorizontal: spacing.xl,
  },
  secondaryButtonText: { color: colors.textPrimary, fontSize: fontSizes.body, fontWeight: '700' },
  dangerButton: {
    alignItems: 'center', backgroundColor: colors.surface, borderColor: colors.danger, borderRadius: radii.pill,
    borderWidth: 1.5, flexDirection: 'row', gap: 6, justifyContent: 'center', minHeight: MIN_TOUCH_TARGET, paddingHorizontal: spacing.lg,
  },
  dangerButtonText: { color: colors.danger, fontSize: fontSizes.label, fontWeight: '700' },
  quietButton: {
    alignItems: 'center', backgroundColor: colors.sage, borderRadius: radii.pill, flexDirection: 'row', gap: 6,
    justifyContent: 'center', minHeight: MIN_TOUCH_TARGET, paddingHorizontal: spacing.lg,
  },
  quietButtonText: { color: colors.textPrimary, fontSize: fontSizes.label, fontWeight: '700' },
  textLink: { alignSelf: 'center', minHeight: MIN_TOUCH_TARGET, justifyContent: 'center' },
  textLinkText: { color: colors.textSecondary, fontSize: fontSizes.bodySmall, fontWeight: '600', textDecorationLine: 'underline' },

  selectPill: {
    alignItems: 'center', backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radii.pill,
    borderWidth: 2, flexDirection: 'row', gap: 5, justifyContent: 'center', minHeight: MIN_TOUCH_TARGET, paddingHorizontal: 18,
  },
  selectPillSelected: { backgroundColor: colors.mint, borderColor: colors.green },
  selectPillText: { color: colors.textSecondary, fontSize: fontSizes.label, fontWeight: '700' },
  selectPillTextSelected: { color: colors.greenDeep },
  tag: { backgroundColor: colors.sage, borderRadius: radii.pill, paddingHorizontal: 10, paddingVertical: 5 },
  tagText: { color: colors.textPrimary, fontSize: fontSizes.tag, fontWeight: '700' },

  field: { gap: 6 },
  fieldLabel: { color: colors.textPrimary, fontSize: fontSizes.label, fontWeight: '700' },
  input: {
    backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radii.input, borderWidth: 1,
    color: colors.textPrimary, fontSize: 17, minHeight: 52, paddingHorizontal: spacing.lg, paddingVertical: 15,
  },
  inputDisabled: { color: colors.textSecondary },
  inputError: { borderColor: colors.danger },
  helperText: { color: colors.textSecondary, fontSize: fontSizes.caption },

  toggleRow: {
    alignItems: 'center', backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radii.action,
    borderWidth: 1, flexDirection: 'row', gap: spacing.md, justifyContent: 'space-between', minHeight: 64, padding: spacing.lg,
  },
  toggleText: { flex: 1, gap: 2 },
  toggleTitle: { color: colors.textPrimary, fontSize: fontSizes.bodySmall, fontWeight: '700' },
  toggleDescription: { color: colors.textSecondary, fontSize: fontSizes.caption },
  toggleTrack: { borderRadius: radii.pill, height: 29, width: 50 },
  toggleKnob: {
    backgroundColor: '#FFFFFF', borderRadius: radii.pill, height: 23, position: 'absolute', top: 3, width: 23,
    shadowColor: '#000000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.2, shadowRadius: 4, elevation: 2,
  },

  locationLine: { alignItems: 'center', flexDirection: 'row', gap: 5 },
  locationText: { color: colors.textSecondary, fontSize: fontSizes.bodySmall },
  locationTextSmall: { fontSize: fontSizes.caption },
  locationTextProminent: {
    color: colors.textPrimary, flexShrink: 1, fontFamily: fonts.heading, fontSize: fontSizes.subheading, fontWeight: '700',
  },

  emptyState: { alignItems: 'center', gap: spacing.md, paddingVertical: spacing.xl },
  emptyIcon: {
    alignItems: 'center', backgroundColor: colors.mint, borderRadius: 24, height: 84, justifyContent: 'center',
    marginBottom: spacing.md, width: 84,
  },
  emptyTitle: { color: colors.textPrimary, fontFamily: fonts.heading, fontSize: 26, fontWeight: '700', textAlign: 'center' },
  emptyDescription: { color: colors.textSecondary, fontSize: fontSizes.body, marginBottom: spacing.md, textAlign: 'center' },

  /**
   * `minHeight` rather than `flex: 1` so these read the same whether the screen
   * scrolls (auto-height column) or not.
   */
  centered: { alignItems: 'center', gap: spacing.lg, justifyContent: 'center', minHeight: 280, padding: spacing.xxl },

  pressed: { opacity: 0.75 },
  pressedCard: { opacity: 0.9, transform: [{ translateY: 1 }] },
});
