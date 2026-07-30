import { Platform } from 'react-native';

/**
 * Design tokens for the PlayMap redesign.
 *
 * Values are transcribed from the "PlayMap Redesign" design canvas. Screens
 * should reference these rather than repeating literal hex codes or radii.
 */

export const colors = {
  /** Warm cream page background used across Parent Mode. */
  pageParent: '#FFF9F0',
  /** Cool mint page background used across Child Mode. */
  pageChild: '#F2F8F2',
  /** Card and input background that sits on either page background. */
  surface: '#FFFEFB',
  border: '#E6DCCF',

  textPrimary: '#3F4A43',
  textSecondary: '#69756E',
  textOnAccent: '#FFFFFF',

  /** Primary action colour, also the Parent Mode / Child Mode badge colour. */
  terracotta: '#A94F3F',
  green: '#5E8F7E',
  greenDeep: '#3F7363',
  greenConfirm: '#4F7D5D',
  danger: '#A74742',

  /** Soft tint fills used for cards, category tiles and icon wells. */
  sage: '#E4EFE5',
  mint: '#E1F2EC',
  butter: '#FFF2CC',
  peach: '#FCE7DC',
  lilac: '#EEE8F3',
  blush: '#F7E6E7',

  /** Readable foregrounds for the butter and lilac tints. */
  amberDeep: '#7A5A16',
  purpleDeep: '#5B4A78',
  accentYellow: '#F4D58B',

  disabledBackground: '#D8DDD8',
  disabledText: '#59635D',
} as const;

export const radii = {
  hero: 26,
  card: 22,
  tile: 20,
  control: 18,
  action: 16,
  input: 14,
  chip: 12,
  pill: 999,
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
} as const;

/**
 * The design uses Georgia for headings. iOS ships Georgia; Android's generic
 * `serif` family is the closest equivalent, and web can fall back to the stack.
 */
export const fonts = {
  heading: Platform.select({ ios: 'Georgia', android: 'serif', default: 'Georgia, serif' }),
} as const;

export const fontSizes = {
  /** Parent Home's opening statement — the largest type in the app. */
  hero: 42,
  display: 38,
  title: 34,
  heading: 30,
  subheading: 24,
  panelTitle: 21,
  cardTitle: 20,
  sectionTitle: 19,
  bodyLarge: 18,
  body: 16,
  bodySmall: 15,
  label: 14.5,
  caption: 13.5,
  badge: 12,
  tag: 11.5,
} as const;

type Shadow = {
  shadowColor: string;
  shadowOffset: { width: number; height: number };
  shadowOpacity: number;
  shadowRadius: number;
  elevation: number;
};

/** Soft warm-brown card shadow from the design. */
export const cardShadow: Shadow = {
  shadowColor: '#594834',
  shadowOffset: { width: 0, height: 4 },
  shadowOpacity: 0.08,
  shadowRadius: 16,
  elevation: 3,
};

/** Stronger tinted shadow used under terracotta primary actions. */
export const accentShadow: Shadow = {
  shadowColor: colors.terracotta,
  shadowOffset: { width: 0, height: 4 },
  shadowOpacity: 0.3,
  shadowRadius: 14,
  elevation: 4,
};

/** Minimum touch target, applied to every interactive primitive. */
export const MIN_TOUCH_TARGET = 44;
