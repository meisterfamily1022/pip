import { ActivityIndicator, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import Svg, { Circle, G, Path, Rect } from 'react-native-svg';

import { pipBrand } from '@/brand/pip-brand';
import { pipLogoColors, playmapTheme as theme } from '@/theme/playmap-theme';

/**
 * The Pip logo, drawn rather than loaded.
 *
 * The same outlines that generate the app icon and favicon are redrawn here as
 * vectors, so the in-app mark is identical to the exported artwork, stays crisp
 * at every size, and can be recoloured for the one-colour contexts without a
 * second asset. Geometry is documented in assets/brand/source/pip-logo-approved.svg.
 */

/** Quicksand Medium outlines, baseline at y=0, 1000 units per em. */
const P_PATH = 'M329-525Q397-525 451-491Q505-457 536.500-397Q568-337 568-259Q568-182 536.500-121.500Q505-61 451.500-26.500Q398 8 331 8Q294 8 261.500-3.500Q229-15 202.500-33.500Q176-52 158-75.500Q140-99 132-122L154-136L154 159Q154 176 143 188Q132 200 114 200Q97 200 85.500 188.500Q74 177 74 159L74-480Q74-497 85.500-508.500Q97-520 114-520Q132-520 143-508.500Q154-497 154-480L154-391L139-399Q146-424 163.500-447Q181-470 206.500-487.500Q232-505 263.500-515Q295-525 329-525M320-451Q270-451 231.500-426Q193-401 171.500-358Q150-315 150-259Q150-204 171.500-160Q193-116 231.500-91Q270-66 320-66Q370-66 408-91Q446-116 468-160Q490-204 490-259Q490-315 468-358Q446-401 408-426Q370-451 320-451';
const DOTLESS_I_PATH = 'M151-485L151-41Q151-24 139.500-12Q128 0 111 0Q93 0 82-12Q71-24 71-41L71-485Q71-502 82.500-513.500Q94-525 111-525Q128-525 139.500-513.500Q151-502 151-485';

/** Ink bounds of each composition, matching the artwork exactly. */
const geometry = {
  wordmark: { viewBox: '134 57 1329 1243', aspectRatio: 1329 / 1243 },
  mark: { viewBox: '74 57 494 1243', aspectRatio: 494 / 1243 },
} as const;

export type PipBrandMarkVariant = 'wordmark' | 'mark';

function Spark({ x, monochrome }: { x: number; monochrome: boolean }) {
  const dot = monochrome ? pipLogoColors.monochrome : pipLogoColors.dot;
  const pink = monochrome ? pipLogoColors.monochrome : pipLogoColors.rayPink;
  const sage = monochrome ? pipLogoColors.monochrome : pipLogoColors.raySage;
  const lavender = monochrome ? pipLogoColors.monochrome : pipLogoColors.rayLavender;
  return (
    <G x={x}>
      <Circle cx={0} cy={-690} r={91} fill={dot} />
      {/* Plain SVG `transform`, not the `rotation`/`origin` props: those reach
          the DOM as an invalid `transform-origin` attribute on web. */}
      <Rect x={-323} y={-887.5} width={206} height={63} rx={31.5} fill={pink} transform="rotate(-45 -220 -856)" />
      <Rect x={-31.5} y={-1043} width={63} height={206} rx={31.5} fill={sage} />
      <Rect x={117} y={-887.5} width={206} height={63} rx={31.5} fill={lavender} transform="rotate(45 220 -856)" />
    </G>
  );
}

/**
 * `mark` is the compact "p" and its spark, for navigation bars, empty states
 * and the launch screen. `wordmark` is the full lockup. Below 22pt wide the
 * wordmark stops being legible, so callers at that size should use the mark.
 */
export function PipBrandMark({
  variant = 'wordmark',
  width,
  monochrome = false,
  style,
}: {
  variant?: PipBrandMarkVariant;
  /** Width in points. Height follows from the mark's own proportions. */
  width?: number;
  monochrome?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const { viewBox, aspectRatio } = geometry[variant];
  const letterFill = monochrome ? pipLogoColors.monochrome : pipLogoColors.wordmark;
  return (
    <View
      accessibilityLabel={pipBrand.name}
      accessibilityRole="image"
      style={[styles.frame, width === undefined ? styles.fluid : { width }, { aspectRatio }, style]}
    >
      <Svg height="100%" viewBox={viewBox} width="100%">
        <G y={1100} fill={letterFill}>
          <Path d={P_PATH} />
          {variant === 'wordmark' ? (
            <>
              <G x={614}><Path d={DOTLESS_I_PATH} /></G>
              <G x={835}><Path d={P_PATH} /></G>
              <Spark monochrome={monochrome} x={725} />
            </>
          ) : (
            <Spark monochrome={monochrome} x={307} />
          )}
        </G>
      </Svg>
    </View>
  );
}

/**
 * Shown while the local database opens. It is a progress indicator, not a
 * splash: it announces itself and never blocks longer than startup takes.
 */
export function PipLaunchState({ label = 'Starting Pip…' }: { label?: string }) {
  return (
    <View accessibilityLabel={label} accessibilityLiveRegion="polite" accessibilityRole="progressbar" style={styles.launch}>
      <PipBrandMark variant="mark" width={44} />
      <ActivityIndicator color={theme.colors.brandInk} />
      <Text style={styles.launchText}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  frame: { alignSelf: 'center', maxWidth: '100%' },
  fluid: { width: '100%' },
  launch: { alignItems: 'center', flex: 1, gap: theme.spacing[16], justifyContent: 'center', padding: theme.spacing[24] },
  launchText: { color: theme.colors.secondaryText, ...theme.typography.meta },
});
