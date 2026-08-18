/**
 * Pip's visual language, as approved in the Pip redesign.
 *
 * Everything the interface can look like is named here. Screens compose these
 * tokens; they do not invent colours, sizes or spacing of their own. The rules
 * the design holds itself to:
 *
 *  - Two type weights, Montserrat 400 and 700. Quicksand is the logo only.
 *  - One shadow. Everything else separates with a border.
 *  - Four radii: control 12, card 16, sheet 24, photo 14 (plus the pill).
 *  - Pastel fills only ever carry deep-tinted labels; never white on a pastel.
 */

import { pipFontFamily } from './fonts';

const palette = {
  /** Deep blue used for text on light surfaces, selection and links. */
  blue700: '#23708B',
  /** The brand blue, at the weight that still carries a dark label. */
  blue500: '#6FC3E2',
  /** The primary action fill. */
  blue400: '#8FD3EE',
  /** Primary action fill while pressed. */
  blue400Pressed: '#6FB4C4',
  /** Label colour on a blue400 fill. */
  blueLabel: '#14424F',
  blue100: '#E8F6FC',

  ink: '#263B43',
  ink60: '#5E7079',
  /**
   * The design sheet draws muted labels at #5F757D. That lands at 4.28:1 on the
   * neutral disabled grounds — short of the 4.6:1 the design says disabled
   * labels hold. Darkened by two steps so muted text clears AA on every ground
   * it is used on, white through #EDF1F2, at no visible cost.
   */
  ink45: '#5A6E77',

  canvas: '#FFFFFF',
  cardSurface: '#F7FBFE',
  cardBorder: '#DCEAF3',
  /** Warm surface used for grouped, explanatory cards. */
  warmSurface: '#FBF7F2',
  warmBorder: '#DCE6E9',
  divider: '#E6EDEF',
  dashedBorder: '#C3D2D6',

  /** Selected card / focused field surface. */
  selectedSurface: '#F3FAFD',
  infoBorder: '#C6E4F2',

  sunshine: '#FFDE96',
  sunshineSurface: '#FFF7E6',
  sunshineBorder: '#F0DDB0',

  sage: '#A9C4A2',

  lavender: '#C2ACEC',
  /** Pip does not use red. Caution and destruction are carried in lavender. */
  alert: '#6B54A3',
  alertSurface: '#F4EFFC',
  alertBorder: '#C9B6EA',
  /** Destructive fill, with its own dark label. */
  destructiveFill: '#CBBAEE',
  destructiveFillLabel: '#3A2C5C',

  successSurface: '#DCEEF2',
  successBorder: '#A9D6E0',
  successMark: '#BFE0C9',
  successMarkInk: '#2C6849',

  neutralSurface: '#EEF1F2',
  neutralBorder: '#D8E2E5',
  /** Slightly deeper neutral, used for a genuinely unavailable card. */
  mutedSurface: '#EDF1F2',
  mutedBorder: '#CBD6DA',

  skeleton: '#E6EDEF',
  skeletonLight: '#EDF1F2',
} as const;

/** The logo's own colours. These belong to the mark and nothing else. */
export const pipLogoColors = {
  wordmark: '#8FD3EE',
  dot: '#FFDE96',
  rayPink: '#F0A9BC',
  raySage: '#B6D9B3',
  rayLavender: '#A98BD4',
  monochrome: '#263B43',
} as const;

/** Avatar tints, paired so the drawn character always has ≥4.5:1 on its ground. */
export const pipAvatarPalette = [
  { surface: '#E7F1FA', ink: '#3C6E8E' },
  { surface: '#EDF6EC', ink: '#4F7548' },
  { surface: '#FFF7E6', ink: '#8A6410' },
  { surface: '#E8F6FC', ink: '#25717F' },
  { surface: '#F5F0FD', ink: '#6A51A8' },
  { surface: '#FBEFF3', ink: '#9A4462' },
] as const;

export const playmapTheme = {
  colors: {
    // ── Brand ────────────────────────────────────────────────────────────
    brandPrimary: palette.blue400,
    brandPrimaryPressed: palette.blue400Pressed,
    brandPrimarySoft: palette.blue100,
    brandPrimaryLabel: palette.blueLabel,
    brandInk: palette.blue700,
    brandBlue: palette.blue500,

    // ── Text ─────────────────────────────────────────────────────────────
    primaryText: palette.ink,
    secondaryText: palette.ink60,
    mutedText: palette.ink45,
    inverseText: palette.canvas,
    linkText: palette.blue700,

    // ── Surfaces ─────────────────────────────────────────────────────────
    background: palette.canvas,
    backgroundCream: palette.canvas,
    childBackground: palette.canvas,
    surface: palette.canvas,
    elevatedSurface: palette.canvas,
    cardSurface: palette.cardSurface,
    warmSurface: palette.warmSurface,
    selectedSurface: palette.selectedSurface,
    neutralSurface: palette.neutralSurface,
    mutedSurface: palette.mutedSurface,

    // ── Borders ──────────────────────────────────────────────────────────
    border: palette.cardBorder,
    warmBorder: palette.warmBorder,
    divider: palette.divider,
    dashedBorder: palette.dashedBorder,
    neutralBorder: palette.neutralBorder,
    mutedBorder: palette.mutedBorder,
    infoBorder: palette.infoBorder,

    // ── Status ───────────────────────────────────────────────────────────
    /** Pip has no red. Errors, warnings and destruction all read as lavender. */
    error: palette.alert,
    errorSoft: palette.alertSurface,
    errorBorder: palette.alertBorder,
    danger: palette.alert,
    destructiveFill: palette.destructiveFill,
    destructiveFillLabel: palette.destructiveFillLabel,
    warning: palette.alert,
    warningSoft: palette.alertSurface,
    success: palette.successMarkInk,
    successSoft: palette.successSurface,
    successBorder: palette.successBorder,
    successMark: palette.successMark,

    // ── Accents ──────────────────────────────────────────────────────────
    accentSunshine: palette.sunshine,
    accentSage: palette.sage,
    accentLavender: palette.lavender,
    surfaceSunshine: palette.sunshineSurface,
    borderSunshine: palette.sunshineBorder,

    // ── Controls ─────────────────────────────────────────────────────────
    disabled: palette.neutralSurface,
    disabledBorder: palette.neutralBorder,
    disabledText: palette.ink45,
    focus: palette.blue700,
    focusRing: 'rgba(20, 96, 111, 0.14)',
    skeleton: palette.skeleton,
    skeletonLight: palette.skeletonLight,
    white: palette.canvas,
    photoFallback: palette.skeletonLight,

    // ── Compatibility aliases ────────────────────────────────────────────
    // Retained so screens not yet migrated keep compiling and stay on-palette.
    text: palette.ink,
    muted: palette.ink45,
    surfaceWarm: palette.warmSurface,
    surfaceCool: palette.cardSurface,
    surfacePeach: palette.cardSurface,
    surfaceSage: palette.cardSurface,
    surfaceMint: palette.blue100,
    surfaceSky: palette.blue100,
    surfaceYellow: palette.sunshineSurface,
    surfaceLavender: palette.alertSurface,
    surfaceBlush: palette.alertSurface,
    peach: palette.blue400,
    peachSoft: palette.blue100,
    sage: palette.sage,
    sageSoft: palette.cardSurface,
    mint: palette.blue500,
    mintSoft: palette.blue100,
    yellow: palette.sunshine,
    yellowSoft: palette.sunshineSurface,
    lavender: palette.lavender,
    lavenderSoft: palette.alertSurface,
    coral: palette.blue400,
    coralDark: palette.blue700,
    coralAction: palette.blue400,
    sageAction: palette.blue700,
    primary: palette.blue400,
    primarySoft: palette.blue100,
    accentMint: palette.blue500,
    accentYellow: palette.sunshine,
  },

  /**
   * The type ramp. Sizes are the Large Dynamic Type default and scale from
   * there. Weight is carried by the family, never by `fontWeight`, so Android
   * cannot synthesise a second bold on top of Montserrat Bold.
   */
  typography: {
    /** 28/32 · 700 — one per screen. */
    pageTitle: { fontFamily: pipFontFamily.bold, fontSize: 28, lineHeight: 32, letterSpacing: -0.5 },
    /** 34/38 · 700 — Child Mode's larger equivalent. */
    childTitle: { fontFamily: pipFontFamily.bold, fontSize: 34, lineHeight: 38, letterSpacing: -0.5 },
    /** 20/26 · 700 */
    sectionTitle: { fontFamily: pipFontFamily.bold, fontSize: 20, lineHeight: 26 },
    /** 17/22 · 700 — row titles and button labels. */
    rowTitle: { fontFamily: pipFontFamily.bold, fontSize: 17, lineHeight: 22 },
    button: { fontFamily: pipFontFamily.bold, fontSize: 17, lineHeight: 22 },
    label: { fontFamily: pipFontFamily.bold, fontSize: 15, lineHeight: 20 },
    /** 13/18 · 700 — the small bold label above a field. */
    fieldLabel: { fontFamily: pipFontFamily.bold, fontSize: 13, lineHeight: 18 },
    /** 16/23 · 400 — body and supporting copy. */
    body: { fontFamily: pipFontFamily.regular, fontSize: 16, lineHeight: 23 },
    /** 13/18 · 400 — meta, captions, counts. */
    meta: { fontFamily: pipFontFamily.regular, fontSize: 13, lineHeight: 18 },
    supporting: { fontFamily: pipFontFamily.regular, fontSize: 13, lineHeight: 18 },
    caption: { fontFamily: pipFontFamily.regular, fontSize: 12, lineHeight: 17 },
    /** 11/14 · 700 · +10% tracking. */
    eyebrow: { fontFamily: pipFontFamily.bold, fontSize: 11, lineHeight: 14, letterSpacing: 1.1 },
    tabLabel: { fontFamily: pipFontFamily.bold, fontSize: 10, lineHeight: 13 },
    tabLabelIdle: { fontFamily: pipFontFamily.regular, fontSize: 10, lineHeight: 13 },
    /** Retained alias; the redesign has no display size above the child title. */
    display: { fontFamily: pipFontFamily.bold, fontSize: 34, lineHeight: 38, letterSpacing: -0.5 },
  },

  fonts: pipFontFamily,

  type: { display: 34, title: 28, childTitle: 34, section: 20, body: 16, small: 13, button: 17 },

  spacing: { 4: 4, 8: 8, 12: 12, 16: 16, 20: 20, 24: 24, 32: 32, 40: 40, xxs: 4, xs: 8, sm: 12, md: 16, lg: 20, xl: 24, xxl: 32, xxxl: 40 },

  /** Control 12 · card 16 · sheet 24 · photo 14 · pill. Nothing else is rounded. */
  radii: { control: 12, card: 16, sheet: 24, photo: 14, pill: 999, small: 12, medium: 16, large: 16, sm: 12, md: 16, lg: 16, xl: 24 },

  measurements: {
    minimumTouchTarget: 44,
    inputHeight: 50,
    primaryButtonHeight: 52,
    childButtonHeight: 60,
    searchHeight: 46,
    pinBoxWidth: 44,
    pinBoxHeight: 54,
    /** Drawn at 36; the control extends its touch target with hitSlop. */
    chipHeight: 36,
    /** Design draws 42. Raised to 44 so the segment itself is a legal target. */
    segmentHeight: 44,
    tabBarHeight: 56,
    cardPadding: 16,
    screenHorizontalPadding: 20,
    sectionGap: 24,
    pageMaxWidth: 720,
    formMaxWidth: 720,
    toyImageAspectRatio: 1,
  },

  sizes: { button: 52, childButton: 60, input: 50 },

  /** One shadow, everywhere. Sheets add a second, upward one. */
  shadows: {
    card: { boxShadow: '0px 2px 10px rgba(28, 48, 55, 0.06)', elevation: 2 } as const,
    sheet: { boxShadow: '0px -4px 24px rgba(28, 48, 55, 0.10)', elevation: 12 } as const,
    segment: { boxShadow: '0px 1px 3px rgba(28, 48, 55, 0.14)', elevation: 1 } as const,
  },

  images: { toyCard: 1, hero: 1.2, upload: 1.4 },
} as const;

export const pipTheme = playmapTheme;

export const screenContentStyle = {
  alignSelf: 'center' as const,
  maxWidth: playmapTheme.measurements.pageMaxWidth,
  paddingHorizontal: playmapTheme.measurements.screenHorizontalPadding,
  paddingTop: playmapTheme.spacing[16],
  paddingBottom: playmapTheme.spacing[32],
  width: '100%' as const,
};
