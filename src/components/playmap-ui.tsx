import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  AccessibilityInfo,
  ActivityIndicator,
  Animated,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type ImageSourcePropType,
  type ImageStyle,
  type PressableProps,
  type StyleProp,
  type TextInputProps,
  type ViewStyle,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { PipIcon, type PipIconName } from '@/components/pip-icon';
import { playmapTheme as theme } from '@/theme/playmap-theme';

/**
 * Pip's component system.
 *
 * Screens compose from here rather than styling their own controls, which is
 * what keeps one shadow, four radii and two type weights true across the app.
 * Rules worth knowing before adding to this file:
 *
 *  - One primary action per screen. Everything else is secondary or quiet.
 *  - Disabled is a real state with a readable label, never a faded primary.
 *  - Selection is never carried by colour alone: a tick, a border weight or a
 *    word carries it too.
 *  - Destructive paths state their consequence and offer the alternative.
 */

// ─────────────────────────────────────────────────────────────────────────────
// Motion
// ─────────────────────────────────────────────────────────────────────────────

/** True when the operating system asks for reduced motion. */
export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    let active = true;
    void AccessibilityInfo.isReduceMotionEnabled().then((value) => {
      if (active) setReduced(value);
    });
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduced);
    return () => {
      active = false;
      subscription.remove();
    };
  }, []);
  return reduced;
}

// ─────────────────────────────────────────────────────────────────────────────
// Screen containers
// ─────────────────────────────────────────────────────────────────────────────

export function ScreenContainer({ children, child = false }: { children: ReactNode; child?: boolean }) {
  return <View style={[styles.screen, child && styles.childScreen]}>{children}</View>;
}

/**
 * The standard screen: safe on all four edges, scrolls its content, and keeps
 * a sticky footer action clear of the keyboard.
 *
 * `footer` is rendered outside the scroll view so a primary action is always
 * reachable — and the scroll content reserves room for it, so the last form
 * field is never trapped underneath.
 */
export function PageShell({
  children,
  child = false,
  scroll = true,
  footer,
  footerPlain = false,
  tabBar,
  contentStyle,
}: {
  children: ReactNode;
  child?: boolean;
  scroll?: boolean;
  footer?: ReactNode;
  /**
   * Drops the footer's hairline and heavier padding, for a bottom slot that
   * holds a quiet link rather than the screen's primary action.
   */
  footerPlain?: boolean;
  tabBar?: ReactNode;
  contentStyle?: StyleProp<ViewStyle>;
}) {
  const content = <View style={[styles.pageContent, contentStyle]}>{children}</View>;
  return (
    <SafeAreaView edges={tabBar ? ['top', 'right', 'left'] : ['top', 'right', 'bottom', 'left']} style={[styles.safePage, child && styles.childScreen]}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.flex}>
        {scroll ? (
          <ScrollView
            contentContainerStyle={styles.pageScroll}
            contentInsetAdjustmentBehavior="automatic"
            keyboardDismissMode="on-drag"
            keyboardShouldPersistTaps="handled"
            // Without an explicit flex the scroll view is sized by its content
            // inside this column, so at large Dynamic Type it grew past the
            // screen and stopped scrolling — the last fields sat under the
            // footer with no way to reach them. `flex: 1` constrains it to the
            // space left over by the footer, and the overflow scrolls again.
            style={styles.flex}
          >
            {content}
          </ScrollView>
        ) : (
          <View style={styles.flex}>{content}</View>
        )}
        {footer ? <StickyFooter plain={footerPlain}>{footer}</StickyFooter> : null}
      </KeyboardAvoidingView>
      {tabBar}
    </SafeAreaView>
  );
}

/**
 * A footer that rides above the keyboard and the home indicator. It carries a
 * hairline and an opaque ground so scrolling content passes behind it legibly
 * rather than showing through.
 *
 * It sits outside the scroll view, in the same flex column, so it never covers
 * content: the scroll area shrinks to make room for it instead.
 *
 * `plain` drops the hairline and the heavier padding for a bottom slot that
 * holds a quiet link rather than the screen's primary action.
 */
export function StickyFooter({ children, plain = false }: { children: ReactNode; plain?: boolean }) {
  const insets = useSafeAreaInsets();
  return (
    <View
      style={[
        styles.stickyFooter,
        plain && styles.stickyFooterPlain,
        { paddingBottom: Math.max(insets.bottom, theme.spacing[8]) + (plain ? 0 : theme.spacing[8]) },
      ]}
    >
      {children}
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Headers and navigation
// ─────────────────────────────────────────────────────────────────────────────

export function BackNavigation({ label = 'Back', onPress }: { label?: string; onPress(): void }) {
  const [focused, setFocused] = useState(false);
  return (
    <Pressable
      accessibilityLabel={label}
      accessibilityRole="button"
      hitSlop={8}
      onBlur={() => setFocused(false)}
      onFocus={() => setFocused(true)}
      onPress={onPress}
      style={({ pressed }) => [styles.backButton, focused && styles.focused, pressed && styles.pressed]}
    >
      <PipIcon color={theme.colors.brandInk} name="chevron-left" size={20} />
      <Text maxFontSizeMultiplier={1.6} style={styles.backLabel}>{label}</Text>
    </Pressable>
  );
}

export function EyebrowLabel({ children }: { children: string }) {
  return <Text maxFontSizeMultiplier={1.8} style={styles.eyebrow}>{children.toUpperCase()}</Text>;
}

export function PageHeader({
  title,
  subtitle,
  eyebrow,
  action,
}: {
  title: string;
  subtitle?: string;
  eyebrow?: string;
  action?: ReactNode;
}) {
  const copy = (
    <>
      {eyebrow ? <EyebrowLabel>{eyebrow}</EyebrowLabel> : null}
      <Text accessibilityRole="header" style={styles.pageTitle}>{title}</Text>
      {subtitle ? <Text style={styles.body}>{subtitle}</Text> : null}
    </>
  );
  return (
    <View style={styles.pageHeader}>
      {action ? (
        <View style={styles.headerRow}>
          <View style={styles.headerCopy}>{copy}</View>
          {action}
        </View>
      ) : (
        copy
      )}
    </View>
  );
}

export function SectionHeading({ title, supporting, action }: { title: string; supporting?: string; action?: ReactNode }) {
  return (
    <View style={styles.headerRow}>
      <View style={styles.headerCopy}>
        <Text accessibilityRole="header" style={styles.sectionTitle}>{title}</Text>
        {supporting ? <Text style={styles.meta}>{supporting}</Text> : null}
      </View>
      {action}
    </View>
  );
}

/**
 * Parent Mode's tab bar. Selection is announced three ways — filled weight,
 * Blue 700 and a bold label — so it never rests on colour alone.
 */
export function TabBar({
  items,
  selected,
  onSelect,
}: {
  items: readonly { key: string; label: string; icon: PipIconName; emphasised?: boolean }[];
  selected: string;
  onSelect(key: string): void;
}) {
  const insets = useSafeAreaInsets();
  return (
    <View accessibilityRole="tablist" style={[styles.tabBar, { paddingBottom: Math.max(insets.bottom, theme.spacing[8]) }]}>
      {items.map((item) => {
        const isSelected = item.key === selected;
        const tint = isSelected ? theme.colors.brandInk : theme.colors.mutedText;
        return (
          <Pressable
            key={item.key}
            accessibilityLabel={item.label}
            accessibilityRole="tab"
            accessibilityState={{ selected: isSelected }}
            onPress={() => onSelect(item.key)}
            style={({ pressed }) => [styles.tabItem, pressed && styles.pressed]}
          >
            {item.emphasised ? (
              <View style={styles.tabAddBadge}>
                <PipIcon color={theme.colors.brandPrimaryLabel} name={item.icon} size={20} strokeWidth={2.4} />
              </View>
            ) : (
              <PipIcon color={tint} name={item.icon} size={22} strokeWidth={isSelected ? 2.5 : 2} />
            )}
            <Text maxFontSizeMultiplier={1.4} numberOfLines={1} style={[styles.tabLabel, isSelected && styles.tabLabelSelected]}>
              {item.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/** Retained for callers that render a plain label row of destinations. */
export function BottomNavigation({ items, selected, onSelect }: { items: readonly string[]; selected: string; onSelect(item: string): void }) {
  return (
    <TabBar
      items={items.map((item) => ({ key: item, label: item, icon: 'chevron-right' as PipIconName }))}
      onSelect={onSelect}
      selected={selected}
    />
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Buttons
// ─────────────────────────────────────────────────────────────────────────────

type ButtonKind = 'primary' | 'secondary' | 'quiet' | 'destructive';

type ButtonProps = Omit<PressableProps, 'children' | 'style'> & {
  label: string;
  accessibilityLabel?: string;
  /** Shows a spinner and blocks activation; the label stays readable. */
  busy?: boolean;
  icon?: PipIconName;
  style?: StyleProp<ViewStyle>;
};

const buttonInk: Record<ButtonKind, string> = {
  primary: theme.colors.brandPrimaryLabel,
  secondary: theme.colors.brandInk,
  quiet: theme.colors.brandInk,
  destructive: theme.colors.error,
};

function ActionButton({ label, kind, accessibilityLabel, busy = false, icon, style, ...props }: ButtonProps & { kind: ButtonKind }) {
  const [focused, setFocused] = useState(false);
  const disabled = Boolean(props.disabled) || busy;
  const ink = disabled ? theme.colors.disabledText : buttonInk[kind];
  return (
    <Pressable
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityRole="button"
      accessibilityState={{ busy, disabled }}
      {...props}
      disabled={disabled}
      onBlur={(event) => { setFocused(false); props.onBlur?.(event); }}
      onFocus={(event) => { setFocused(true); props.onFocus?.(event); }}
      style={({ pressed }) => [
        styles.button,
        styles[`${kind}Button`],
        disabled && styles.disabledButton,
        focused && !disabled && styles.focused,
        pressed && !disabled && styles[`${kind}Pressed`],
        style,
      ]}
    >
      {busy ? <ActivityIndicator color={ink} size="small" /> : null}
      {icon && !busy ? <PipIcon color={ink} name={icon} size={20} /> : null}
      <Text maxFontSizeMultiplier={1.8} style={[styles.buttonText, { color: ink }]}>{label}</Text>
    </Pressable>
  );
}

export function PrimaryButton(props: ButtonProps) { return <ActionButton {...props} kind="primary" />; }
export function SecondaryButton(props: ButtonProps) { return <ActionButton {...props} kind="secondary" />; }
export function QuietButton(props: ButtonProps) { return <ActionButton {...props} kind="quiet" />; }
export function DestructiveButton(props: ButtonProps) { return <ActionButton {...props} kind="destructive" />; }

/** The larger, calmer action used throughout Child Mode. */
export function ChildPrimaryButton({ style, ...props }: ButtonProps) {
  return <ActionButton {...props} kind="primary" style={[styles.childButton, style]} />;
}
export function ChildSecondaryButton({ style, ...props }: ButtonProps) {
  return <ActionButton {...props} kind="secondary" style={[styles.childButton, style]} />;
}

/**
 * A square, icon-only control. `accessibilityLabel` is required because there
 * is no visible text to fall back on.
 */
export function IconButton({
  icon,
  accessibilityLabel,
  onPress,
  tone = 'quiet',
  disabled = false,
}: {
  icon: PipIconName;
  accessibilityLabel: string;
  onPress(): void;
  tone?: 'quiet' | 'surface';
  disabled?: boolean;
}) {
  const [focused, setFocused] = useState(false);
  return (
    <Pressable
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onBlur={() => setFocused(false)}
      onFocus={() => setFocused(true)}
      onPress={onPress}
      style={({ pressed }) => [
        styles.iconButton,
        tone === 'surface' && styles.iconButtonSurface,
        focused && !disabled && styles.focused,
        pressed && !disabled && styles.pressed,
      ]}
    >
      <PipIcon color={disabled ? theme.colors.disabledText : theme.colors.brandInk} name={icon} size={22} />
    </Pressable>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Fields
// ─────────────────────────────────────────────────────────────────────────────

/**
 * A labelled text field. The error sits directly beneath the input and is
 * announced politely, so it is heard next rather than interrupting typing.
 */
export function RoundedTextInput({
  label,
  error,
  hint,
  ...props
}: TextInputProps & { label?: string; error?: string | null; hint?: string }) {
  const [focused, setFocused] = useState(false);
  return (
    <View style={styles.field}>
      {label ? <Text style={styles.fieldLabel}>{label}</Text> : null}
      <TextInput
        {...props}
        accessibilityHint={hint ?? props.accessibilityHint}
        accessibilityLabel={props.accessibilityLabel ?? label}
        onBlur={(event) => { setFocused(false); props.onBlur?.(event); }}
        onFocus={(event) => { setFocused(true); props.onFocus?.(event); }}
        placeholderTextColor={theme.colors.mutedText}
        style={[styles.input, focused && styles.inputFocused, error ? styles.inputError : null, props.style]}
      />
      {hint && !error ? <Text style={styles.meta}>{hint}</Text> : null}
      {error !== undefined ? (
        <Text accessibilityLiveRegion="polite" style={styles.errorText}>{error ?? ''}</Text>
      ) : null}
    </View>
  );
}

/** The pill search field. Submitting runs the search; clearing is one tap. */
export function SearchField({
  value,
  onChangeText,
  placeholder = 'Search toys',
  onSubmitEditing,
  accessibilityLabel,
}: {
  value: string;
  onChangeText(value: string): void;
  placeholder?: string;
  onSubmitEditing?(): void;
  accessibilityLabel?: string;
}) {
  const [focused, setFocused] = useState(false);
  return (
    <View style={[styles.search, focused && styles.searchFocused]}>
      <PipIcon color={theme.colors.mutedText} name="search" size={18} />
      <TextInput
        accessibilityLabel={accessibilityLabel ?? placeholder}
        autoCapitalize="none"
        autoCorrect={false}
        clearButtonMode="never"
        onBlur={() => setFocused(false)}
        onChangeText={onChangeText}
        onFocus={() => setFocused(true)}
        onSubmitEditing={onSubmitEditing}
        placeholder={placeholder}
        placeholderTextColor={theme.colors.mutedText}
        returnKeyType="search"
        style={styles.searchInput}
        value={value}
      />
      {value.length > 0 ? (
        <Pressable accessibilityLabel="Clear search" accessibilityRole="button" hitSlop={12} onPress={() => onChangeText('')}>
          <PipIcon color={theme.colors.mutedText} name="close" size={16} />
        </Pressable>
      ) : null}
    </View>
  );
}

/**
 * Four separate boxes with a number pad and secure entry.
 *
 * On a wrong entry the fields shake once — suppressed under Reduce Motion,
 * where they simply turn and stay lavender until the next keystroke.
 */
export function PinInput({
  value,
  onChangeText,
  length = 4,
  label,
  error,
  autoFocus = false,
  accessibilityLabel = 'PIN',
}: {
  value: string;
  onChangeText(value: string): void;
  length?: number;
  label?: string;
  error?: string | null;
  autoFocus?: boolean;
  accessibilityLabel?: string;
}) {
  const input = useRef<TextInput>(null);
  const [focused, setFocused] = useState(false);
  // useMemo, not useRef: the value is read during render to build the
  // transform, and reading a ref there is not allowed.
  const shake = useMemo(() => new Animated.Value(0), []);
  const reducedMotion = useReducedMotion();

  useEffect(() => {
    if (!error || reducedMotion) return;
    Animated.sequence([
      Animated.timing(shake, { toValue: 1, duration: 60, useNativeDriver: true }),
      Animated.timing(shake, { toValue: -1, duration: 60, useNativeDriver: true }),
      Animated.timing(shake, { toValue: 0, duration: 60, useNativeDriver: true }),
    ]).start();
  }, [error, reducedMotion, shake]);

  const translateX = shake.interpolate({ inputRange: [-1, 1], outputRange: [-6, 6] });

  return (
    <View style={styles.field}>
      {label ? <Text style={styles.fieldLabel}>{label}</Text> : null}
      <View style={[styles.pinStack, { width: (length * theme.measurements.pinBoxWidth) + ((length - 1) * theme.spacing[8]) }]}>
        <Animated.View
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          pointerEvents="none"
          style={[styles.pinRow, { transform: [{ translateX }] }]}
        >
          {Array.from({ length }, (_, index) => {
            const filled = index < value.length;
            const isNext = index === value.length && focused;
            return (
              <View
                key={index}
                style={[styles.pinBox, isNext && styles.pinBoxFocused, error ? styles.pinBoxError : null]}
              >
                {filled ? <View style={styles.pinDot} /> : null}
              </View>
            );
          })}
        </Animated.View>
        {/*
          The real field covers the whole row rather than hiding in a 1px box.
          A hidden input is unreachable by touch outside the boxes and invisible
          to a screen reader, which left no way at all to enter a PIN with
          VoiceOver on. Its own text is transparent; the boxes above are the
          visible rendering of what it holds.
        */}
        <TextInput
          ref={input}
          accessibilityHint={`Enter your ${length}-digit PIN`}
          accessibilityLabel={accessibilityLabel}
          accessibilityValue={{ text: `${value.length} of ${length} digits entered` }}
          autoFocus={autoFocus}
          caretHidden
          importantForAutofill="no"
          keyboardType="number-pad"
          maxLength={length}
          onBlur={() => setFocused(false)}
          onChangeText={(next) => onChangeText(next.replace(/\D/g, '').slice(0, length))}
          onFocus={() => setFocused(true)}
          secureTextEntry
          // The boxes carry the focus treatment, so the browser's own focus
          // ring would be a second, differently-shaped outline on the same
          // control. `outlineStyle` is React Native Web only, hence the cast.
          style={[styles.pinInput, { outlineStyle: 'none' } as never]}
          textContentType="oneTimeCode"
          value={value}
        />
      </View>
      {error !== undefined ? (
        <Text accessibilityLiveRegion="polite" style={[styles.errorText, styles.centred]}>{error ?? ''}</Text>
      ) : null}
    </View>
  );
}

export function ReadOnlyValue({ label, value }: { label: string; value: string }) {
  return (
    <View accessibilityLabel={`${label}: ${value}`} style={styles.readOnlyValue}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <Text style={styles.rowTitle}>{value}</Text>
    </View>
  );
}

export function RoundedSelect({
  label,
  value,
  placeholder = 'Select an option',
  onPress,
  accessibilityLabel,
  error,
}: {
  label?: string;
  value?: string;
  placeholder?: string;
  onPress(): void;
  accessibilityLabel?: string;
  error?: string | null;
}) {
  const [focused, setFocused] = useState(false);
  return (
    <View style={styles.field}>
      {label ? <Text style={styles.fieldLabel}>{label}</Text> : null}
      <Pressable
        accessibilityHint="Opens a list of options"
        accessibilityLabel={accessibilityLabel ?? label}
        accessibilityRole="button"
        accessibilityValue={{ text: value ?? placeholder }}
        onBlur={() => setFocused(false)}
        onFocus={() => setFocused(true)}
        onPress={onPress}
        style={({ pressed }) => [styles.input, styles.selectRow, focused && styles.inputFocused, error ? styles.inputError : null, pressed && styles.pressed]}
      >
        <Text numberOfLines={1} style={[styles.selectValue, !value && styles.placeholder]}>{value ?? placeholder}</Text>
        <PipIcon color={theme.colors.brandInk} name="chevron-down" size={18} />
      </Pressable>
      {error !== undefined ? <Text accessibilityLiveRegion="polite" style={styles.errorText}>{error ?? ''}</Text> : null}
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Chips, segments and toggles
// ─────────────────────────────────────────────────────────────────────────────

export function FilterChip({
  label,
  selected = false,
  disabled = false,
  onPress,
  onRemove,
}: {
  label: string;
  selected?: boolean;
  disabled?: boolean;
  onPress?(): void;
  /** When present the chip reads as an applied filter and offers removal. */
  onRemove?(): void;
}) {
  const [focused, setFocused] = useState(false);
  const ink = disabled ? theme.colors.disabledText : selected ? theme.colors.brandPrimaryLabel : theme.colors.primaryText;
  return (
    <Pressable
      accessibilityLabel={label}
      accessibilityRole={onRemove ? 'button' : 'checkbox'}
      accessibilityState={{ checked: onRemove ? undefined : selected, disabled, selected }}
      disabled={disabled}
      // The chip is drawn at 36pt; hitSlop lifts the target past 44.
      hitSlop={{ bottom: 6, left: 4, right: 4, top: 6 }}
      onBlur={() => setFocused(false)}
      onFocus={() => setFocused(true)}
      onPress={onRemove ?? onPress}
      style={({ pressed }) => [
        styles.chip,
        selected && styles.chipSelected,
        disabled && styles.chipDisabled,
        focused && !disabled && styles.focused,
        pressed && !disabled && styles.pressed,
      ]}
    >
      {selected && !onRemove ? <PipIcon color={ink} name="check" size={14} strokeWidth={2.6} /> : null}
      <Text maxFontSizeMultiplier={1.6} style={[styles.chipText, { color: ink }, selected && styles.chipTextSelected]}>{label}</Text>
      {onRemove ? <PipIcon color={ink} name="close" size={13} strokeWidth={2.4} /> : null}
    </Pressable>
  );
}

export function CategoryChip(props: { label: string; selected?: boolean; disabled?: boolean; onPress(): void }) {
  return <FilterChip {...props} />;
}

export function SegmentedControl<T extends string | number | boolean>({
  options,
  value,
  onChange,
  accessibilityLabel = 'Options',
  getOptionLabel = String,
}: {
  options: readonly T[];
  value: T;
  onChange(value: T): void;
  accessibilityLabel?: string;
  getOptionLabel?(option: T): string;
}) {
  return (
    <View accessibilityLabel={accessibilityLabel} accessibilityRole="radiogroup" style={styles.segmented}>
      {options.map((option) => {
        const selected = option === value;
        const label = getOptionLabel(option);
        return (
          <Pressable
            key={String(option)}
            accessibilityLabel={label}
            accessibilityRole="radio"
            accessibilityState={{ checked: selected, selected }}
            onPress={() => onChange(option)}
            style={({ pressed }) => [styles.segment, selected && styles.segmentSelected, pressed && !selected && styles.pressed]}
          >
            <Text maxFontSizeMultiplier={1.5} numberOfLines={1} style={[styles.segmentText, selected && styles.segmentTextSelected]}>{label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function ToggleRow({
  label,
  description,
  value,
  disabled = false,
  onValueChange,
}: {
  label: string;
  description?: string;
  value: boolean;
  disabled?: boolean;
  onValueChange(value: boolean): void;
}) {
  const [focused, setFocused] = useState(false);
  return (
    <Pressable
      accessibilityHint={description}
      accessibilityLabel={label}
      accessibilityRole="switch"
      accessibilityState={{ checked: value, disabled }}
      disabled={disabled}
      onBlur={() => setFocused(false)}
      onFocus={() => setFocused(true)}
      onPress={() => onValueChange(!value)}
      style={({ pressed }) => [
        styles.toggleRow,
        disabled && styles.disabledSurface,
        focused && !disabled && styles.focused,
        pressed && !disabled && styles.pressed,
      ]}
    >
      <View style={styles.rowCopy}>
        <Text style={[styles.rowTitleSmall, disabled && styles.disabledText]}>{label}</Text>
        {description ? <Text style={[styles.meta, disabled && styles.disabledText]}>{description}</Text> : null}
      </View>
      <View accessibilityElementsHidden style={[styles.toggle, value && styles.toggleOn, disabled && styles.toggleDisabled]}>
        <View style={[styles.toggleKnob, value && styles.toggleKnobOn]} />
      </View>
    </Pressable>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Surfaces
// ─────────────────────────────────────────────────────────────────────────────

export type CardTone = 'plain' | 'surface' | 'warm' | 'selected' | 'sunshine' | 'alert' | 'info' | 'muted';

const cardTones: Record<CardTone, ViewStyle> = {
  plain: { backgroundColor: theme.colors.surface, borderColor: theme.colors.border },
  surface: { backgroundColor: theme.colors.cardSurface, borderColor: theme.colors.border },
  warm: { backgroundColor: theme.colors.warmSurface, borderColor: theme.colors.warmBorder },
  selected: { backgroundColor: theme.colors.selectedSurface, borderColor: theme.colors.brandInk, borderWidth: 2 },
  sunshine: { backgroundColor: theme.colors.surfaceSunshine, borderColor: theme.colors.borderSunshine },
  alert: { backgroundColor: theme.colors.errorSoft, borderColor: theme.colors.errorBorder },
  info: { backgroundColor: theme.colors.selectedSurface, borderColor: theme.colors.infoBorder },
  muted: { backgroundColor: theme.colors.mutedSurface, borderColor: theme.colors.mutedBorder },
};

export function Card({ children, tone = 'surface', style }: { children: ReactNode; tone?: CardTone; style?: StyleProp<ViewStyle> }) {
  return <View style={[styles.card, cardTones[tone], style]}>{children}</View>;
}

export function FormCard({ children, tone = 'surface', style }: { children: ReactNode; tone?: CardTone; style?: StyleProp<ViewStyle> }) {
  return <Card style={[styles.formCard, style]} tone={tone}>{children}</Card>;
}

/** A grouped list. Rows inside are separated by a hairline, not by gaps. */
export function ListCard({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[styles.listCard, style]}>{children}</View>;
}

export function ListRow({
  title,
  detail,
  value,
  icon,
  onPress,
  accessory = 'chevron',
  tone = 'default',
  indented = false,
  disabled = false,
}: {
  title: string;
  detail?: string;
  value?: string;
  icon?: PipIconName;
  onPress?(): void;
  accessory?: 'chevron' | 'none' | 'check';
  tone?: 'default' | 'danger';
  indented?: boolean;
  disabled?: boolean;
}) {
  const [focused, setFocused] = useState(false);
  const ink = tone === 'danger' ? theme.colors.error : disabled ? theme.colors.disabledText : theme.colors.primaryText;
  const body = (
    <>
      {icon ? <PipIcon color={ink} name={icon} size={20} /> : null}
      <View style={styles.rowCopy}>
        <Text style={[styles.rowTitleSmall, { color: ink }]}>{title}</Text>
        {detail ? <Text style={styles.meta}>{detail}</Text> : null}
      </View>
      {value ? <Text numberOfLines={1} style={styles.rowValue}>{value}</Text> : null}
      {accessory === 'chevron' && onPress ? <PipIcon color={theme.colors.mutedText} name="chevron-right" size={18} /> : null}
      {accessory === 'check' ? <PipIcon color={theme.colors.brandInk} name="check" size={18} strokeWidth={2.6} /> : null}
    </>
  );
  if (!onPress) return <View style={[styles.listRow, indented && styles.listRowIndented]}>{body}</View>;
  return (
    <Pressable
      accessibilityHint={detail}
      accessibilityLabel={value ? `${title}, ${value}` : title}
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onBlur={() => setFocused(false)}
      onFocus={() => setFocused(true)}
      onPress={onPress}
      style={({ pressed }) => [styles.listRow, indented && styles.listRowIndented, focused && styles.focused, pressed && styles.pressed]}
    >
      {body}
    </Pressable>
  );
}

/** A tappable card that leads somewhere, with an optional leading icon tile. */
export function PastelNavigationCard({
  title,
  description,
  icon,
  tone = 'surface',
  onPress,
  disabled = false,
}: {
  title: string;
  description?: string;
  icon?: PipIconName;
  tone?: CardTone;
  onPress?(): void;
  disabled?: boolean;
}) {
  const [focused, setFocused] = useState(false);
  return (
    <Pressable
      accessibilityHint={description}
      accessibilityLabel={title}
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onBlur={() => setFocused(false)}
      onFocus={() => setFocused(true)}
      onPress={onPress}
      style={({ pressed }) => [
        styles.card,
        styles.navigationCard,
        cardTones[disabled ? 'muted' : tone],
        focused && !disabled && styles.focused,
        pressed && !disabled && styles.pressed,
      ]}
    >
      {icon ? (
        <View style={styles.iconTile}>
          <PipIcon color={theme.colors.brandInk} name={icon} size={22} />
        </View>
      ) : null}
      <View style={styles.rowCopy}>
        <Text style={[styles.rowTitle, disabled && styles.disabledText]}>{title}</Text>
        {description ? <Text style={styles.meta}>{description}</Text> : null}
      </View>
      <PipIcon color={disabled ? theme.colors.disabledText : theme.colors.brandInk} name="chevron-right" size={18} />
    </Pressable>
  );
}

export function ChildActionCard(props: { title: string; description: string; icon?: PipIconName; tone?: CardTone; onPress(): void; disabled?: boolean }) {
  return <PastelNavigationCard {...props} />;
}

/**
 * One choice among a small set, drawn as a card rather than a radio row so the
 * supporting sentence is part of the target. Selection shows as a tick, a
 * heavier border and a change of ground — never colour alone.
 */
export function OptionCard({
  title,
  description,
  selected,
  onPress,
  disabled = false,
}: {
  title: string;
  description?: string;
  selected: boolean;
  onPress(): void;
  disabled?: boolean;
}) {
  const [focused, setFocused] = useState(false);
  return (
    <Pressable
      accessibilityHint={description}
      accessibilityLabel={title}
      accessibilityRole="radio"
      accessibilityState={{ checked: selected, disabled, selected }}
      disabled={disabled}
      onBlur={() => setFocused(false)}
      onFocus={() => setFocused(true)}
      onPress={onPress}
      style={({ pressed }) => [
        styles.card,
        styles.optionCard,
        cardTones[disabled ? 'muted' : selected ? 'selected' : 'surface'],
        focused && !disabled && styles.focused,
        pressed && !disabled && styles.pressed,
      ]}
    >
      <View style={styles.rowCopy}>
        <Text style={[styles.rowTitleSmall, disabled && styles.disabledText]}>{title}</Text>
        {description ? <Text style={styles.meta}>{description}</Text> : null}
      </View>
      <View style={[styles.optionMark, selected && styles.optionMarkSelected]}>
        {selected ? <PipIcon color={theme.colors.brandPrimaryLabel} name="check" size={14} strokeWidth={3} /> : null}
      </View>
    </Pressable>
  );
}

export function StatCard({ value, label }: { value: string | number; label: string }) {
  return (
    <View accessibilityLabel={`${value} ${label}`} style={styles.statCard}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.meta}>{label}</Text>
    </View>
  );
}

export function LocationChip({ label }: { label: string }) {
  return (
    <View style={styles.locationChip}>
      <Text style={styles.locationText}>{label}</Text>
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Banners, toasts and states
// ─────────────────────────────────────────────────────────────────────────────

export type BannerTone = 'info' | 'alert' | 'success' | 'sunshine';

/**
 * An inline message attached to the content it concerns. Alerts are announced
 * assertively; everything else politely.
 */
export function Banner({
  tone = 'info',
  title,
  message,
  action,
  icon,
}: {
  tone?: BannerTone;
  title?: string;
  message: string;
  action?: ReactNode;
  icon?: PipIconName;
}) {
  const ink = tone === 'alert' ? theme.colors.error : tone === 'success' ? theme.colors.brandPrimaryLabel : theme.colors.secondaryText;
  const defaultIcon: PipIconName = tone === 'alert' ? 'alert' : tone === 'success' ? 'check' : 'info';
  return (
    <View
      accessibilityLiveRegion={tone === 'alert' ? 'assertive' : 'polite'}
      accessibilityRole="alert"
      style={[styles.banner, cardTones[tone === 'success' ? 'info' : tone === 'sunshine' ? 'sunshine' : tone === 'alert' ? 'alert' : 'info'], tone === 'success' && styles.bannerSuccess]}
    >
      <PipIcon color={ink} name={icon ?? defaultIcon} size={18} />
      <View style={styles.rowCopy}>
        {title ? <Text style={[styles.bannerTitle, { color: ink }]}>{title}</Text> : null}
        <Text style={[styles.bannerText, { color: ink }]}>{message}</Text>
      </View>
      {action}
    </View>
  );
}

/** A short confirmation of something that already happened. */
export function Toast({ message }: { message: string }) {
  return (
    <View accessibilityLiveRegion="polite" accessibilityRole="alert" style={styles.toast}>
      <View style={styles.toastMark}>
        <PipIcon color={theme.colors.success} name="check" size={12} strokeWidth={3} />
      </View>
      <Text style={styles.toastText}>{message}</Text>
    </View>
  );
}

export function EmptyStateCard({
  title,
  message,
  icon = 'sparkle',
  action,
}: {
  title: string;
  message: string;
  icon?: PipIconName;
  action?: ReactNode;
}) {
  return (
    <View style={[styles.card, cardTones.surface, styles.stateCard]}>
      <View style={styles.iconTile}>
        <PipIcon color={theme.colors.brandInk} name={icon} size={22} />
      </View>
      <Text accessibilityRole="header" style={styles.rowTitleSmall}>{title}</Text>
      <Text style={[styles.meta, styles.centred]}>{message}</Text>
      {action ? <View style={styles.stateAction}>{action}</View> : null}
    </View>
  );
}

export function ErrorStateCard({ title = 'That did not load', message, action }: { title?: string; message: string; action?: ReactNode }) {
  return (
    <View accessibilityLiveRegion="polite" accessibilityRole="alert" style={[styles.card, cardTones.alert, styles.stateCard]}>
      <View style={[styles.iconTile, styles.iconTileAlert]}>
        <PipIcon color={theme.colors.error} name="alert" size={22} />
      </View>
      <Text accessibilityRole="header" style={[styles.rowTitleSmall, styles.alertInk]}>{title}</Text>
      <Text style={[styles.meta, styles.centred, styles.alertInk]}>{message}</Text>
      {action ? <View style={styles.stateAction}>{action}</View> : null}
    </View>
  );
}

export function LoadingState({ label = 'Loading…' }: { label?: string }) {
  return (
    <View accessibilityLabel={label} accessibilityLiveRegion="polite" accessibilityRole="progressbar" style={styles.loading}>
      <ActivityIndicator color={theme.colors.brandInk} />
      <Text style={styles.meta}>{label}</Text>
    </View>
  );
}

/**
 * Placeholder rows shown while real content loads. They replace the old blue
 * "Refreshing…" bar, which covered the status bar and said nothing useful.
 */
export function SkeletonRows({ rows = 3, label = 'Loading…' }: { rows?: number; label?: string }) {
  return (
    <View accessibilityLabel={label} accessibilityRole="progressbar" style={styles.skeletonList}>
      {Array.from({ length: rows }, (_, index) => (
        <View key={index} accessibilityElementsHidden style={styles.skeletonRow}>
          <View style={styles.skeletonThumb} />
          <View style={styles.skeletonLines}>
            <View style={[styles.skeletonLine, { width: '78%' }]} />
            <View style={[styles.skeletonLine, styles.skeletonLineFaint, { width: '52%' }]} />
          </View>
        </View>
      ))}
    </View>
  );
}

export function SkeletonGrid({ tiles = 6, label = 'Loading toys…' }: { tiles?: number; label?: string }) {
  return (
    <View accessibilityLabel={label} accessibilityRole="progressbar" style={styles.skeletonGrid}>
      {Array.from({ length: tiles }, (_, index) => (
        <View key={index} accessibilityElementsHidden style={styles.skeletonTile}>
          <View style={styles.skeletonPhoto} />
          <View style={[styles.skeletonLine, { width: '70%' }]} />
          <View style={[styles.skeletonLine, styles.skeletonLineFaint, { width: '45%' }]} />
        </View>
      ))}
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Photos
// ─────────────────────────────────────────────────────────────────────────────

export function ToyImage({
  uri,
  source,
  accessibilityLabel = 'Toy photo',
  style,
}: {
  uri?: string | null;
  source?: ImageSourcePropType;
  accessibilityLabel?: string;
  style?: StyleProp<ImageStyle>;
}) {
  const [failed, setFailed] = useState(false);
  if ((uri || source) && !failed) {
    return (
      <Image
        accessibilityIgnoresInvertColors
        accessibilityLabel={accessibilityLabel}
        onError={() => setFailed(true)}
        source={source ?? { uri: uri ?? undefined }}
        style={[styles.toyImage, style]}
      />
    );
  }
  return (
    <View accessibilityLabel="No photo yet" style={[styles.toyImage, styles.imageFallback, style]}>
      <PipIcon color={theme.colors.mutedText} name="photo-missing" size={22} />
      <Text style={styles.imageFallbackText}>No photo yet</Text>
    </View>
  );
}

export function ImageTile({ uri, label = 'Toy photo', size = 56 }: { uri?: string | null; label?: string; size?: number }) {
  const [failed, setFailed] = useState(false);
  return (
    <View style={[styles.imageTile, { height: size, width: size }]}>
      {uri && !failed ? (
        <Image accessibilityIgnoresInvertColors accessibilityLabel={label} onError={() => setFailed(true)} source={{ uri }} style={styles.fill} />
      ) : (
        <View accessibilityLabel="No photo yet" style={styles.imageFallback}>
          <PipIcon color={theme.colors.mutedText} name="photo-missing" size={Math.round(size * 0.36)} />
        </View>
      )}
    </View>
  );
}

export type ToyCardStatus = 'available' | 'selected' | 'checked-out' | 'unavailable' | 'hidden' | 'no-photo';

/**
 * The library's photo-first card.
 *
 * Status is carried by a word on the card as well as by treatment, so a
 * checked-out toy reads as checked out without relying on the dimmed photo.
 */
export function ToyPhotoCard({
  title,
  location,
  uri,
  status = 'available',
  holderName,
  onPress,
  photoHeight = 104,
}: {
  title: string;
  location?: string;
  uri?: string | null;
  status?: ToyCardStatus;
  /** The child currently playing with this toy, when there is one. */
  holderName?: string;
  onPress?(): void;
  photoHeight?: number;
}) {
  const [focused, setFocused] = useState(false);
  const statusWord =
    status === 'selected' ? 'Selected'
      : status === 'checked-out' ? 'Out for play'
        : status === 'unavailable' ? 'Not available' :
          status === 'hidden' ? 'Hidden' :
            status === 'no-photo' ? 'Add photo' : location;
  const dimmed = status === 'checked-out' || status === 'unavailable';
  const body = (
    <>
      <View style={[styles.toyCardPhoto, { height: photoHeight }]}>
        <ToyImage accessibilityLabel={`${title} photo`} style={[styles.fill, dimmed && styles.dimmed]} uri={uri} />
        {status === 'selected' ? (
          <View style={styles.selectedBadge}>
            <PipIcon color={theme.colors.brandPrimaryLabel} name="check" size={13} strokeWidth={3} />
          </View>
        ) : null}
        {holderName ? (
          <View style={styles.holderPill}>
            <Text maxFontSizeMultiplier={1.4} numberOfLines={1} style={styles.holderPillText}>{`With ${holderName}`}</Text>
          </View>
        ) : null}
      </View>
      <View style={styles.toyCardBody}>
        <Text numberOfLines={2} style={[styles.toyCardTitle, dimmed && styles.mutedInk]}>{title}</Text>
        {statusWord ? (
          <Text numberOfLines={1} style={[styles.toyCardMeta, status === 'selected' && styles.brandInk, dimmed && styles.alertInk, status === 'no-photo' && styles.brandInk]}>
            {statusWord}
          </Text>
        ) : null}
      </View>
    </>
  );
  const accessibilityLabel = [title, location, statusWord !== location ? statusWord : undefined, holderName ? `with ${holderName}` : undefined]
    .filter(Boolean).join(', ');
  if (!onPress) return <View style={[styles.toyCard, status === 'selected' && styles.toyCardSelected]}>{body}</View>;
  return (
    <Pressable
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="button"
      accessibilityState={{ selected: status === 'selected' }}
      onBlur={() => setFocused(false)}
      onFocus={() => setFocused(true)}
      onPress={onPress}
      style={({ pressed }) => [styles.toyCard, status === 'selected' && styles.toyCardSelected, focused && styles.focused, pressed && styles.pressed]}
    >
      {body}
    </Pressable>
  );
}

/** Retained name; screens that used the old list-style card keep working. */
export function ToyCard({ title, location, uri, action, onPress }: { title: string; location?: string; uri?: string | null; action?: string; onPress?(): void }) {
  return <ToyPhotoCard location={location ?? action} onPress={onPress} title={title} uri={uri} />;
}

// ─────────────────────────────────────────────────────────────────────────────
// Sheets and dialogs
// ─────────────────────────────────────────────────────────────────────────────

/** A bottom sheet. Dismissible by the escape gesture and by an explicit action. */
export function Sheet({
  visible,
  title,
  subtitle,
  onDismiss,
  children,
}: {
  visible: boolean;
  title?: string;
  subtitle?: string;
  onDismiss(): void;
  children: ReactNode;
}) {
  const insets = useSafeAreaInsets();
  return (
    <Modal animationType="slide" onRequestClose={onDismiss} transparent visible={visible}>
      <View accessibilityViewIsModal onAccessibilityEscape={onDismiss} style={styles.sheetBackdrop}>
        <Pressable accessibilityLabel="Close" accessibilityRole="button" onPress={onDismiss} style={styles.backdropCatcher} />
        <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, theme.spacing[12]) + theme.spacing[8] }]}>
          <View accessibilityElementsHidden style={styles.sheetGrabber} />
          {title ? <Text accessibilityRole="header" style={styles.sheetTitle}>{title}</Text> : null}
          {subtitle ? <Text style={styles.meta}>{subtitle}</Text> : null}
          {children}
        </View>
      </View>
    </Modal>
  );
}

/**
 * A confirmation that states the consequence before it offers the action. The
 * keep-it choice is listed first and is the easier target.
 */
export function ConfirmationDialog({
  visible,
  title,
  message,
  confirmLabel = 'Continue',
  cancelLabel = 'Cancel',
  onCancel,
  onConfirm,
  destructive = false,
  busy = false,
  children,
}: {
  visible: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onCancel(): void;
  onConfirm(): void;
  destructive?: boolean;
  busy?: boolean;
  /** Extra content between the message and the actions, e.g. an alternative. */
  children?: ReactNode;
}) {
  return (
    <Modal animationType="fade" onRequestClose={onCancel} transparent visible={visible}>
      <View accessibilityViewIsModal onAccessibilityEscape={onCancel} style={styles.modalBackdrop}>
        <View style={styles.modalCard}>
          <Text accessibilityRole="header" style={styles.rowTitle}>{title}</Text>
          <Text style={styles.meta}>{message}</Text>
          {children}
          <View style={styles.modalActions}>
            <SecondaryButton label={cancelLabel} onPress={onCancel} style={styles.modalButton} />
            {destructive ? (
              <Pressable
                accessibilityLabel={confirmLabel}
                accessibilityRole="button"
                accessibilityState={{ busy, disabled: busy }}
                disabled={busy}
                onPress={onConfirm}
                style={({ pressed }) => [styles.button, styles.modalButton, styles.destructiveFill, pressed && styles.pressed]}
              >
                {busy ? <ActivityIndicator color={theme.colors.destructiveFillLabel} size="small" /> : null}
                <Text maxFontSizeMultiplier={1.8} style={[styles.buttonText, styles.destructiveFillText]}>{confirmLabel}</Text>
              </Pressable>
            ) : (
              <PrimaryButton busy={busy} label={confirmLabel} onPress={onConfirm} style={styles.modalButton} />
            )}
          </View>
        </View>
      </View>
    </Modal>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Progress
// ─────────────────────────────────────────────────────────────────────────────

export function StepIndicator({ steps, current }: { steps: readonly string[]; current: number }) {
  return (
    <View accessibilityLabel={`Step ${current + 1} of ${steps.length}: ${steps[current] ?? ''}`} accessibilityRole="progressbar" style={styles.steps}>
      {steps.map((step, index) => {
        const done = index < current;
        const active = index === current;
        return (
          <View key={step} accessibilityElementsHidden style={styles.step}>
            <View style={[styles.stepDot, (done || active) && styles.stepDotActive]}>
              {done ? (
                <PipIcon color={theme.colors.white} name="check" size={13} strokeWidth={3} />
              ) : (
                <Text style={[styles.stepNumber, active && styles.stepNumberActive]}>{index + 1}</Text>
              )}
            </View>
            <Text maxFontSizeMultiplier={1.4} numberOfLines={1} style={[styles.meta, active && styles.stepLabelActive]}>{step}</Text>
          </View>
        );
      })}
    </View>
  );
}

/** The "STEP 1 OF 3" rule used across onboarding, above the screen title. */
export function StepEyebrow({ current, total, onBack }: { current: number; total: number; onBack?(): void }) {
  return (
    <View style={styles.stepEyebrowRow}>
      {onBack ? <BackNavigation onPress={onBack} /> : <View />}
      <Text accessibilityLabel={`Step ${current} of ${total}`} style={styles.eyebrow}>{`STEP ${current} OF ${total}`}</Text>
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Styles
// ─────────────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  flex: { flex: 1 },
  fill: { height: '100%', width: '100%' },
  centred: { textAlign: 'center' },
  pressed: { opacity: 0.72 },
  focused: { boxShadow: `0 0 0 3px ${theme.colors.background}, 0 0 0 6px ${theme.colors.focus}` },
  dimmed: { opacity: 0.45 },
  mutedInk: { color: theme.colors.mutedText },
  brandInk: { color: theme.colors.brandInk },
  alertInk: { color: theme.colors.error },
  disabledText: { color: theme.colors.disabledText },
  disabledSurface: { backgroundColor: theme.colors.disabled, borderColor: theme.colors.disabledBorder },

  // Containers
  screen: { backgroundColor: theme.colors.background, flex: 1 },
  safePage: { backgroundColor: theme.colors.background, flex: 1 },
  childScreen: { backgroundColor: theme.colors.background },
  pageScroll: { flexGrow: 1 },
  pageContent: {
    alignSelf: 'center',
    gap: theme.spacing[16],
    maxWidth: theme.measurements.pageMaxWidth,
    paddingBottom: theme.spacing[32],
    paddingHorizontal: theme.measurements.screenHorizontalPadding,
    paddingTop: theme.spacing[8],
    width: '100%',
  },
  stickyFooter: {
    backgroundColor: theme.colors.background,
    borderTopColor: theme.colors.divider,
    borderTopWidth: StyleSheet.hairlineWidth,
    gap: theme.spacing[8],
    paddingHorizontal: theme.measurements.screenHorizontalPadding,
    paddingTop: theme.spacing[12],
  },
  stickyFooterPlain: { borderTopWidth: 0, paddingTop: theme.spacing[4] },

  // Header
  pageHeader: { gap: theme.spacing[8] },
  headerRow: { alignItems: 'center', flexDirection: 'row', gap: theme.spacing[12] },
  headerCopy: { flex: 1, gap: 4 },
  pageTitle: { color: theme.colors.primaryText, ...theme.typography.pageTitle },
  sectionTitle: { color: theme.colors.primaryText, ...theme.typography.sectionTitle },
  rowTitle: { color: theme.colors.primaryText, ...theme.typography.rowTitle },
  rowTitleSmall: { color: theme.colors.primaryText, ...theme.typography.label },
  rowValue: { color: theme.colors.secondaryText, maxWidth: '45%', ...theme.typography.meta },
  body: { color: theme.colors.secondaryText, ...theme.typography.body },
  meta: { color: theme.colors.secondaryText, ...theme.typography.meta },
  eyebrow: { color: theme.colors.brandInk, ...theme.typography.eyebrow },
  fieldLabel: { color: theme.colors.primaryText, ...theme.typography.fieldLabel },
  backButton: {
    alignItems: 'center',
    alignSelf: 'flex-start',
    flexDirection: 'row',
    gap: 2,
    minHeight: theme.measurements.minimumTouchTarget,
    paddingRight: theme.spacing[8],
  },
  backLabel: { color: theme.colors.brandInk, ...theme.typography.label },
  stepEyebrowRow: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between', minHeight: theme.measurements.minimumTouchTarget },

  // Tab bar
  tabBar: {
    backgroundColor: theme.colors.cardSurface,
    borderTopColor: theme.colors.divider,
    borderTopWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingTop: theme.spacing[8],
  },
  tabItem: { alignItems: 'center', gap: 4, minHeight: theme.measurements.minimumTouchTarget, minWidth: 56, paddingHorizontal: 4 },
  tabAddBadge: {
    alignItems: 'center',
    backgroundColor: theme.colors.brandPrimary,
    borderRadius: theme.radii.pill,
    height: 28,
    justifyContent: 'center',
    marginTop: -3,
    width: 28,
  },
  tabLabel: { color: theme.colors.mutedText, ...theme.typography.tabLabelIdle },
  tabLabelSelected: { color: theme.colors.brandInk, ...theme.typography.tabLabel },

  // Buttons
  button: {
    alignItems: 'center',
    borderRadius: theme.radii.control,
    flexDirection: 'row',
    gap: theme.spacing[8],
    justifyContent: 'center',
    minHeight: theme.measurements.primaryButtonHeight,
    paddingHorizontal: theme.spacing[16],
  },
  childButton: { borderRadius: theme.radii.photo, minHeight: theme.measurements.childButtonHeight },
  buttonText: { textAlign: 'center', ...theme.typography.button },
  primaryButton: { backgroundColor: theme.colors.brandPrimary },
  primaryPressed: { backgroundColor: theme.colors.brandPrimaryPressed, opacity: 1 },
  secondaryButton: { backgroundColor: theme.colors.surface, borderColor: theme.colors.brandInk, borderWidth: 1.5 },
  secondaryPressed: { backgroundColor: theme.colors.brandPrimarySoft, opacity: 1 },
  quietButton: { backgroundColor: 'transparent', minHeight: theme.measurements.minimumTouchTarget },
  quietPressed: { backgroundColor: theme.colors.brandPrimarySoft, opacity: 1 },
  destructiveButton: { backgroundColor: theme.colors.surface, borderColor: theme.colors.error, borderWidth: 1.5 },
  destructivePressed: { backgroundColor: theme.colors.errorSoft, opacity: 1 },
  disabledButton: { backgroundColor: theme.colors.disabled, borderColor: theme.colors.disabledBorder, borderWidth: 1 },
  destructiveFill: { backgroundColor: theme.colors.destructiveFill },
  destructiveFillText: { color: theme.colors.destructiveFillLabel },
  iconButton: {
    alignItems: 'center',
    borderRadius: theme.radii.control,
    height: theme.measurements.minimumTouchTarget,
    justifyContent: 'center',
    width: theme.measurements.minimumTouchTarget,
  },
  iconButtonSurface: { backgroundColor: theme.colors.cardSurface, borderColor: theme.colors.border, borderWidth: 1 },

  // Fields
  field: { gap: 5 },
  input: {
    backgroundColor: theme.colors.cardSurface,
    borderColor: theme.colors.border,
    borderRadius: theme.radii.control,
    borderWidth: 1,
    color: theme.colors.primaryText,
    minHeight: theme.measurements.inputHeight,
    paddingHorizontal: theme.spacing[12],
    paddingVertical: theme.spacing[12],
    ...theme.typography.body,
  },
  inputFocused: {
    backgroundColor: theme.colors.selectedSurface,
    borderColor: theme.colors.focus,
    borderWidth: 2,
    boxShadow: `0 0 0 3px ${theme.colors.focusRing}`,
    paddingHorizontal: theme.spacing[12] - 1,
  },
  inputError: { backgroundColor: theme.colors.selectedSurface, borderColor: theme.colors.error, borderWidth: 2, paddingHorizontal: theme.spacing[12] - 1 },
  errorText: { color: theme.colors.error, minHeight: 18, ...theme.typography.meta },
  selectRow: { alignItems: 'center', flexDirection: 'row', gap: theme.spacing[8], justifyContent: 'space-between' },
  selectValue: { color: theme.colors.primaryText, flex: 1, ...theme.typography.body },
  placeholder: { color: theme.colors.mutedText },
  readOnlyValue: {
    backgroundColor: theme.colors.cardSurface,
    borderColor: theme.colors.border,
    borderRadius: theme.radii.control,
    borderWidth: 1,
    gap: 2,
    paddingHorizontal: theme.spacing[12],
    paddingVertical: theme.spacing[12],
  },
  search: {
    alignItems: 'center',
    backgroundColor: theme.colors.cardSurface,
    borderColor: theme.colors.border,
    borderRadius: theme.radii.pill,
    borderWidth: 1,
    flexDirection: 'row',
    gap: theme.spacing[8],
    minHeight: theme.measurements.searchHeight,
    paddingHorizontal: theme.spacing[16],
  },
  searchFocused: { backgroundColor: theme.colors.selectedSurface, borderColor: theme.colors.focus, borderWidth: 2, paddingHorizontal: theme.spacing[16] - 1 },
  searchInput: { color: theme.colors.primaryText, flex: 1, paddingVertical: theme.spacing[8], ...theme.typography.body },

  // PIN
  pinStack: { alignSelf: 'center', justifyContent: 'center' },
  pinRow: { flexDirection: 'row', gap: theme.spacing[8], justifyContent: 'center' },
  pinBox: {
    alignItems: 'center',
    backgroundColor: theme.colors.cardSurface,
    borderColor: theme.colors.border,
    borderRadius: theme.radii.control,
    borderWidth: 1,
    height: theme.measurements.pinBoxHeight,
    justifyContent: 'center',
    width: theme.measurements.pinBoxWidth,
  },
  pinBoxFocused: { backgroundColor: theme.colors.selectedSurface, borderColor: theme.colors.focus, borderWidth: 2, boxShadow: `0 0 0 3px ${theme.colors.focusRing}` },
  pinBoxError: { backgroundColor: theme.colors.errorSoft, borderColor: theme.colors.error, borderWidth: 2 },
  pinDot: { backgroundColor: theme.colors.primaryText, borderRadius: 6, height: 12, width: 12 },
  /** Covers the boxes so a tap anywhere on the row opens the number pad. */
  pinInput: {
    bottom: 0,
    color: 'transparent',
    left: 0,
    position: 'absolute',
    right: 0,
    textAlign: 'center',
    top: 0,
  },

  // Chips, segments, toggle
  chip: {
    alignItems: 'center',
    backgroundColor: theme.colors.cardSurface,
    borderColor: theme.colors.border,
    borderRadius: theme.radii.pill,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 5,
    height: theme.measurements.chipHeight,
    justifyContent: 'center',
    paddingHorizontal: theme.spacing[12],
  },
  chipSelected: { backgroundColor: theme.colors.brandPrimary, borderColor: theme.colors.brandPrimary },
  chipDisabled: { backgroundColor: theme.colors.disabled, borderColor: theme.colors.disabledBorder },
  chipText: { ...theme.typography.meta, fontSize: 14 },
  chipTextSelected: { fontFamily: theme.fonts.bold },
  segmented: { backgroundColor: theme.colors.neutralSurface, borderRadius: theme.radii.control, flexDirection: 'row', gap: 3, padding: 3 },
  segment: {
    alignItems: 'center',
    borderRadius: 9,
    flex: 1,
    justifyContent: 'center',
    minHeight: theme.measurements.segmentHeight,
    paddingHorizontal: theme.spacing[4],
  },
  segmentSelected: { backgroundColor: theme.colors.surface, ...theme.shadows.segment },
  segmentText: { color: theme.colors.secondaryText, ...theme.typography.body, fontSize: 15 },
  segmentTextSelected: { color: theme.colors.brandInk, fontFamily: theme.fonts.bold },
  toggleRow: {
    alignItems: 'center',
    backgroundColor: theme.colors.cardSurface,
    borderColor: theme.colors.border,
    borderRadius: theme.radii.control,
    borderWidth: 1,
    flexDirection: 'row',
    gap: theme.spacing[12],
    minHeight: 60,
    paddingHorizontal: theme.spacing[16],
    paddingVertical: theme.spacing[12],
  },
  toggle: { backgroundColor: theme.colors.neutralBorder, borderRadius: theme.radii.pill, height: 30, justifyContent: 'center', padding: 3, width: 50 },
  toggleOn: { backgroundColor: theme.colors.brandInk },
  toggleDisabled: { opacity: 0.55 },
  toggleKnob: { backgroundColor: theme.colors.white, borderRadius: theme.radii.pill, height: 24, width: 24 },
  toggleKnobOn: { alignSelf: 'flex-end' },

  // Surfaces
  card: { borderRadius: theme.radii.card, borderWidth: 1, gap: theme.spacing[8], padding: theme.measurements.cardPadding },
  formCard: { alignSelf: 'stretch', maxWidth: theme.measurements.formMaxWidth, width: '100%' },
  navigationCard: { alignItems: 'center', flexDirection: 'row', gap: theme.spacing[12], minHeight: 64 },
  optionCard: { alignItems: 'center', flexDirection: 'row', gap: theme.spacing[12], minHeight: 60 },
  optionMark: {
    alignItems: 'center',
    borderColor: theme.colors.neutralBorder,
    borderRadius: theme.radii.pill,
    borderWidth: 1.5,
    height: 24,
    justifyContent: 'center',
    width: 24,
  },
  optionMarkSelected: { backgroundColor: theme.colors.brandPrimary, borderColor: theme.colors.brandPrimary },
  listCard: {
    backgroundColor: theme.colors.cardSurface,
    borderColor: theme.colors.border,
    borderRadius: theme.radii.card,
    borderWidth: 1,
    overflow: 'hidden',
  },
  listRow: {
    alignItems: 'center',
    borderTopColor: theme.colors.divider,
    borderTopWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    gap: theme.spacing[12],
    minHeight: 52,
    paddingHorizontal: theme.spacing[16],
    paddingVertical: theme.spacing[12],
  },
  listRowIndented: { paddingLeft: theme.spacing[40] },
  rowCopy: { flex: 1, gap: 2 },
  iconTile: {
    alignItems: 'center',
    backgroundColor: theme.colors.brandPrimarySoft,
    borderRadius: theme.radii.control,
    height: 40,
    justifyContent: 'center',
    width: 40,
  },
  iconTileAlert: { backgroundColor: theme.colors.errorSoft },
  statCard: {
    backgroundColor: theme.colors.cardSurface,
    borderColor: theme.colors.border,
    borderRadius: theme.radii.card,
    borderWidth: 1,
    flex: 1,
    gap: 2,
    justifyContent: 'center',
    minHeight: 64,
    padding: theme.spacing[12],
  },
  statValue: { color: theme.colors.primaryText, ...theme.typography.sectionTitle },
  locationChip: {
    alignSelf: 'flex-start',
    backgroundColor: theme.colors.brandPrimarySoft,
    borderRadius: theme.radii.pill,
    paddingHorizontal: theme.spacing[12],
    paddingVertical: 5,
  },
  locationText: { color: theme.colors.brandInk, ...theme.typography.meta },

  // Banners, toasts, states
  banner: {
    alignItems: 'flex-start',
    borderRadius: theme.radii.control,
    borderWidth: 1,
    flexDirection: 'row',
    gap: theme.spacing[8],
    paddingHorizontal: theme.spacing[12],
    paddingVertical: theme.spacing[12],
  },
  bannerSuccess: { backgroundColor: theme.colors.successSoft, borderColor: theme.colors.successBorder },
  bannerTitle: { ...theme.typography.label, fontSize: 14 },
  bannerText: { ...theme.typography.meta },
  toast: {
    alignItems: 'center',
    backgroundColor: theme.colors.successSoft,
    borderColor: theme.colors.successBorder,
    borderRadius: theme.radii.control,
    borderWidth: 1,
    flexDirection: 'row',
    gap: theme.spacing[8],
    paddingHorizontal: theme.spacing[12],
    paddingVertical: theme.spacing[12],
  },
  toastMark: {
    alignItems: 'center',
    backgroundColor: theme.colors.successMark,
    borderRadius: theme.radii.pill,
    height: 18,
    justifyContent: 'center',
    width: 18,
  },
  toastText: { color: theme.colors.brandPrimaryLabel, flex: 1, ...theme.typography.label, fontSize: 14 },
  stateCard: { alignItems: 'center', gap: 6, paddingVertical: theme.spacing[20] },
  stateAction: { alignSelf: 'stretch', marginTop: theme.spacing[8] },
  loading: { alignItems: 'center', flex: 1, gap: theme.spacing[12], justifyContent: 'center', padding: theme.spacing[24] },
  skeletonList: { gap: theme.spacing[12] },
  skeletonRow: { alignItems: 'center', flexDirection: 'row', gap: theme.spacing[12] },
  skeletonThumb: { backgroundColor: theme.colors.skeleton, borderRadius: theme.radii.control, height: 56, width: 56 },
  skeletonLines: { flex: 1, gap: 7 },
  skeletonLine: { backgroundColor: theme.colors.skeleton, borderRadius: 6, height: 13 },
  skeletonLineFaint: { backgroundColor: theme.colors.skeletonLight, height: 11 },
  skeletonGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing[12] },
  skeletonTile: { flexBasis: '47%', flexGrow: 1, gap: 7 },
  skeletonPhoto: { backgroundColor: theme.colors.skeleton, borderRadius: theme.radii.photo, height: 104 },

  // Photos
  toyImage: { aspectRatio: 1, backgroundColor: theme.colors.photoFallback, width: '100%' },
  imageFallback: { alignItems: 'center', flex: 1, gap: 4, justifyContent: 'center' },
  imageFallbackText: { color: theme.colors.mutedText, ...theme.typography.caption },
  imageTile: { backgroundColor: theme.colors.photoFallback, borderRadius: theme.radii.control, overflow: 'hidden' },
  toyCard: {
    backgroundColor: theme.colors.cardSurface,
    borderColor: theme.colors.border,
    borderRadius: theme.radii.card,
    borderWidth: 1,
    overflow: 'hidden',
  },
  toyCardSelected: { backgroundColor: theme.colors.selectedSurface, borderColor: theme.colors.brandInk, borderWidth: 2 },
  toyCardPhoto: { backgroundColor: theme.colors.photoFallback, width: '100%' },
  toyCardBody: { gap: 2, paddingHorizontal: theme.spacing[12], paddingVertical: 10 },
  toyCardTitle: { color: theme.colors.primaryText, ...theme.typography.label, fontSize: 14 },
  toyCardMeta: { color: theme.colors.secondaryText, ...theme.typography.caption },
  selectedBadge: {
    alignItems: 'center',
    backgroundColor: theme.colors.brandPrimary,
    borderRadius: theme.radii.pill,
    height: 24,
    justifyContent: 'center',
    position: 'absolute',
    right: 7,
    top: 7,
    width: 24,
  },
  holderPill: {
    backgroundColor: theme.colors.errorSoft,
    borderColor: theme.colors.error,
    borderRadius: theme.radii.pill,
    borderWidth: 1,
    left: 7,
    maxWidth: '86%',
    paddingHorizontal: theme.spacing[8],
    paddingVertical: 2,
    position: 'absolute',
    top: 7,
  },
  holderPillText: { color: theme.colors.error, ...theme.typography.caption, fontFamily: theme.fonts.bold, fontSize: 10 },

  // Sheets and dialogs
  sheetBackdrop: { backgroundColor: 'rgba(38, 59, 67, 0.36)', flex: 1, justifyContent: 'flex-end' },
  backdropCatcher: { flex: 1 },
  sheet: {
    ...theme.shadows.sheet,
    backgroundColor: theme.colors.background,
    borderTopLeftRadius: theme.radii.sheet,
    borderTopRightRadius: theme.radii.sheet,
    gap: theme.spacing[12],
    paddingHorizontal: theme.measurements.screenHorizontalPadding,
    paddingTop: theme.spacing[8],
  },
  sheetGrabber: {
    alignSelf: 'center',
    backgroundColor: theme.colors.neutralBorder,
    borderRadius: theme.radii.pill,
    height: 4,
    marginBottom: theme.spacing[8],
    width: 40,
  },
  sheetTitle: { color: theme.colors.primaryText, ...theme.typography.sectionTitle },
  modalBackdrop: {
    alignItems: 'center',
    backgroundColor: 'rgba(38, 59, 67, 0.36)',
    flex: 1,
    justifyContent: 'center',
    padding: theme.spacing[20],
  },
  modalCard: {
    backgroundColor: theme.colors.surface,
    borderColor: theme.colors.neutralBorder,
    borderRadius: theme.radii.card,
    borderWidth: 1,
    gap: 6,
    maxWidth: 420,
    padding: theme.spacing[16],
    width: '100%',
  },
  modalActions: { flexDirection: 'row', gap: theme.spacing[8], marginTop: theme.spacing[8] },
  modalButton: { flex: 1, minHeight: 46 },

  // Progress
  steps: { flexDirection: 'row', gap: theme.spacing[8] },
  step: { alignItems: 'center', flex: 1, gap: 6 },
  stepDot: {
    alignItems: 'center',
    backgroundColor: theme.colors.neutralSurface,
    borderRadius: theme.radii.pill,
    height: 30,
    justifyContent: 'center',
    width: 30,
  },
  stepDotActive: { backgroundColor: theme.colors.brandInk },
  stepNumber: { color: theme.colors.secondaryText, ...theme.typography.label, fontSize: 14 },
  stepNumberActive: { color: theme.colors.white },
  stepLabelActive: { color: theme.colors.brandInk, fontFamily: theme.fonts.bold },
});
