import { memo } from 'react';
import { View } from 'react-native';
import Svg, { Circle, Path, Rect, type SvgProps } from 'react-native-svg';

import { playmapTheme as theme } from '@/theme/playmap-theme';

/**
 * Pip's icon set.
 *
 * Every icon is drawn on the same 24-unit grid with a round-capped monoline
 * stroke, so a row of them reads as one family at any size. Icons never carry
 * meaning on their own: each one is paired with a label, or given an
 * accessibility label by the control that owns it.
 */

export type PipIconName =
  // Navigation
  | 'home' | 'library' | 'add' | 'spaces' | 'settings'
  // Movement and disclosure
  | 'chevron-right' | 'chevron-left' | 'chevron-down' | 'close' | 'more' | 'back'
  // Actions
  | 'search' | 'plus' | 'check' | 'retry' | 'rotate' | 'crop' | 'trash' | 'edit'
  | 'camera' | 'photos' | 'lock' | 'speaker' | 'help' | 'drag'
  // Status
  | 'alert' | 'info' | 'offline' | 'photo-missing' | 'sparkle'
  // Play types
  | 'quiet' | 'active' | 'building' | 'creative' | 'pretend' | 'sensory'
  | 'independent' | 'together' | 'indoor' | 'outdoor'
  // Avatar characters
  | 'bear' | 'chick' | 'star' | 'fish' | 'balloon' | 'cat' | 'rocket' | 'flower';

type Glyph = (props: { color: string; strokeWidth: number }) => React.ReactNode;

const S = (d: string) => ({ d });

/**
 * Path data is written against the 24-unit grid. The six play-type glyphs and
 * the five avatar characters are taken directly from the approved design; the
 * rest are drawn to match them.
 */
const glyphs: Record<PipIconName, Glyph> = {
  // ── Navigation ──────────────────────────────────────────────────────────
  home: ({ color, strokeWidth }) => (
    <>
      <Path {...S('M3.4 10.2 12 3.6l8.6 6.6')} stroke={color} strokeWidth={strokeWidth} />
      <Path {...S('M5.4 11.6V19a1.4 1.4 0 0 0 1.4 1.4h10.4a1.4 1.4 0 0 0 1.4-1.4v-7.4')} stroke={color} strokeWidth={strokeWidth} />
    </>
  ),
  library: ({ color, strokeWidth }) => (
    <>
      <Rect x={3.4} y={3.4} width={7.2} height={7.2} rx={1.8} stroke={color} strokeWidth={strokeWidth} />
      <Rect x={13.4} y={3.4} width={7.2} height={7.2} rx={1.8} stroke={color} strokeWidth={strokeWidth} />
      <Rect x={3.4} y={13.4} width={7.2} height={7.2} rx={1.8} stroke={color} strokeWidth={strokeWidth} />
      <Rect x={13.4} y={13.4} width={7.2} height={7.2} rx={1.8} stroke={color} strokeWidth={strokeWidth} />
    </>
  ),
  add: ({ color, strokeWidth }) => (
    <>
      <Path {...S('M12 5.6v12.8')} stroke={color} strokeWidth={strokeWidth} />
      <Path {...S('M5.6 12h12.8')} stroke={color} strokeWidth={strokeWidth} />
    </>
  ),
  spaces: ({ color, strokeWidth }) => (
    <>
      <Rect x={3.4} y={4.4} width={17.2} height={15.2} rx={2} stroke={color} strokeWidth={strokeWidth} />
      <Path {...S('M3.4 9.4h17.2')} stroke={color} strokeWidth={strokeWidth} />
      <Path {...S('M10 14.6h4')} stroke={color} strokeWidth={strokeWidth} />
    </>
  ),
  settings: ({ color, strokeWidth }) => (
    <>
      <Path {...S('M4 7.4h16')} stroke={color} strokeWidth={strokeWidth} />
      <Path {...S('M4 12h16')} stroke={color} strokeWidth={strokeWidth} />
      <Path {...S('M4 16.6h16')} stroke={color} strokeWidth={strokeWidth} />
    </>
  ),

  // ── Movement and disclosure ─────────────────────────────────────────────
  'chevron-right': ({ color, strokeWidth }) => <Path {...S('M9.2 4.8 16.4 12l-7.2 7.2')} stroke={color} strokeWidth={strokeWidth} />,
  'chevron-left': ({ color, strokeWidth }) => <Path {...S('M14.8 4.8 7.6 12l7.2 7.2')} stroke={color} strokeWidth={strokeWidth} />,
  back: ({ color, strokeWidth }) => <Path {...S('M14.8 4.8 7.6 12l7.2 7.2')} stroke={color} strokeWidth={strokeWidth} />,
  'chevron-down': ({ color, strokeWidth }) => <Path {...S('M4.8 9.2 12 16.4l7.2-7.2')} stroke={color} strokeWidth={strokeWidth} />,
  close: ({ color, strokeWidth }) => (
    <>
      <Path {...S('M5.8 5.8l12.4 12.4')} stroke={color} strokeWidth={strokeWidth} />
      <Path {...S('M18.2 5.8L5.8 18.2')} stroke={color} strokeWidth={strokeWidth} />
    </>
  ),
  more: ({ color }) => (
    <>
      <Circle cx={5.4} cy={12} r={1.7} fill={color} />
      <Circle cx={12} cy={12} r={1.7} fill={color} />
      <Circle cx={18.6} cy={12} r={1.7} fill={color} />
    </>
  ),

  // ── Actions ─────────────────────────────────────────────────────────────
  search: ({ color, strokeWidth }) => (
    <>
      <Circle cx={10.8} cy={10.8} r={6.4} stroke={color} strokeWidth={strokeWidth} />
      <Path {...S('M15.6 15.6l4.2 4.2')} stroke={color} strokeWidth={strokeWidth} />
    </>
  ),
  plus: ({ color, strokeWidth }) => (
    <>
      <Path {...S('M12 5.6v12.8')} stroke={color} strokeWidth={strokeWidth} />
      <Path {...S('M5.6 12h12.8')} stroke={color} strokeWidth={strokeWidth} />
    </>
  ),
  check: ({ color, strokeWidth }) => <Path {...S('M5 12.8l4.6 4.4L19 6.8')} stroke={color} strokeWidth={strokeWidth} />,
  retry: ({ color, strokeWidth }) => (
    <>
      <Path {...S('M20 12a8 8 0 1 1-2.6-5.9')} stroke={color} strokeWidth={strokeWidth} />
      <Path {...S('M20 3.6V9h-5.4')} stroke={color} strokeWidth={strokeWidth} />
    </>
  ),
  rotate: ({ color, strokeWidth }) => (
    <>
      <Path {...S('M4 12a8 8 0 1 0 2.6-5.9')} stroke={color} strokeWidth={strokeWidth} />
      <Path {...S('M4 3.6V9h5.4')} stroke={color} strokeWidth={strokeWidth} />
    </>
  ),
  crop: ({ color, strokeWidth }) => (
    <>
      <Path {...S('M6.4 2.6v15h15')} stroke={color} strokeWidth={strokeWidth} />
      <Path {...S('M2.6 6.4h15v15')} stroke={color} strokeWidth={strokeWidth} />
    </>
  ),
  trash: ({ color, strokeWidth }) => (
    <>
      <Path {...S('M4.4 6.6h15.2')} stroke={color} strokeWidth={strokeWidth} />
      <Path {...S('M9.4 6.6V4.8a1.4 1.4 0 0 1 1.4-1.4h2.4a1.4 1.4 0 0 1 1.4 1.4v1.8')} stroke={color} strokeWidth={strokeWidth} />
      <Path {...S('M6.4 6.6l.9 12.4a1.6 1.6 0 0 0 1.6 1.4h6.2a1.6 1.6 0 0 0 1.6-1.4l.9-12.4')} stroke={color} strokeWidth={strokeWidth} />
    </>
  ),
  edit: ({ color, strokeWidth }) => (
    <>
      <Path {...S('M4 20.2l.9-4 10.4-10.4a1.8 1.8 0 0 1 2.6 0l1 1a1.8 1.8 0 0 1 0 2.6L8.5 19.8l-4.5.4Z')} stroke={color} strokeWidth={strokeWidth} />
      <Path {...S('M13.6 7.1l3.3 3.3')} stroke={color} strokeWidth={strokeWidth} />
    </>
  ),
  camera: ({ color, strokeWidth }) => (
    <>
      <Path {...S('M3.4 8.6a1.8 1.8 0 0 1 1.8-1.8h2.3l1.3-2.2h6.4l1.3 2.2h2.3a1.8 1.8 0 0 1 1.8 1.8v9a1.8 1.8 0 0 1-1.8 1.8H5.2a1.8 1.8 0 0 1-1.8-1.8Z')} stroke={color} strokeWidth={strokeWidth} />
      <Circle cx={12} cy={13} r={3.6} stroke={color} strokeWidth={strokeWidth} />
    </>
  ),
  photos: ({ color, strokeWidth }) => (
    <>
      <Rect x={3.4} y={5.4} width={17.2} height={13.2} rx={2} stroke={color} strokeWidth={strokeWidth} />
      <Path {...S('M3.4 15.4l4.4-4.2 4.6 4.4 3-2.8 5.2 4.8')} stroke={color} strokeWidth={strokeWidth} />
      <Circle cx={8.6} cy={9.6} r={1.4} stroke={color} strokeWidth={strokeWidth} />
    </>
  ),
  lock: ({ color, strokeWidth }) => (
    <>
      <Rect x={4.6} y={10.4} width={14.8} height={10} rx={2.2} stroke={color} strokeWidth={strokeWidth} />
      <Path {...S('M8 10.4V7.8a4 4 0 0 1 8 0v2.6')} stroke={color} strokeWidth={strokeWidth} />
    </>
  ),
  speaker: ({ color, strokeWidth }) => (
    <>
      <Path {...S('M4 9.4h3.4L12 5.2v13.6L7.4 14.6H4Z')} stroke={color} strokeWidth={strokeWidth} />
      <Path {...S('M15.6 9.4a4 4 0 0 1 0 5.2')} stroke={color} strokeWidth={strokeWidth} />
      <Path {...S('M18.4 6.8a7.8 7.8 0 0 1 0 10.4')} stroke={color} strokeWidth={strokeWidth} />
    </>
  ),
  help: ({ color, strokeWidth }) => (
    <>
      <Circle cx={12} cy={12} r={8.6} stroke={color} strokeWidth={strokeWidth} />
      <Path {...S('M9.4 9.4a2.7 2.7 0 0 1 5.2.9c0 1.8-2.6 2.3-2.6 4')} stroke={color} strokeWidth={strokeWidth} />
      <Circle cx={12} cy={17.4} r={1.05} fill={color} />
    </>
  ),
  drag: ({ color, strokeWidth }) => (
    <>
      <Path {...S('M7 8.6h10')} stroke={color} strokeWidth={strokeWidth} />
      <Path {...S('M7 12h10')} stroke={color} strokeWidth={strokeWidth} />
      <Path {...S('M7 15.4h10')} stroke={color} strokeWidth={strokeWidth} />
    </>
  ),

  // ── Status ──────────────────────────────────────────────────────────────
  alert: ({ color, strokeWidth }) => (
    <>
      <Circle cx={12} cy={12} r={8.6} stroke={color} strokeWidth={strokeWidth} />
      <Path {...S('M12 7.4v5.6')} stroke={color} strokeWidth={strokeWidth} />
      <Circle cx={12} cy={16.6} r={1.05} fill={color} />
    </>
  ),
  info: ({ color, strokeWidth }) => (
    <>
      <Circle cx={12} cy={12} r={8.6} stroke={color} strokeWidth={strokeWidth} />
      <Path {...S('M12 11v5.6')} stroke={color} strokeWidth={strokeWidth} />
      <Circle cx={12} cy={7.6} r={1.05} fill={color} />
    </>
  ),
  offline: ({ color, strokeWidth }) => (
    <>
      <Path {...S('M2.6 9.4a13.4 13.4 0 0 1 18.8 0')} stroke={color} strokeWidth={strokeWidth} />
      <Path {...S('M6.6 13.2a8 8 0 0 1 10.8 0')} stroke={color} strokeWidth={strokeWidth} />
      <Circle cx={12} cy={18} r={1.4} fill={color} />
      <Path {...S('M3.4 3.4l17.2 17.2')} stroke={color} strokeWidth={strokeWidth} />
    </>
  ),
  'photo-missing': ({ color, strokeWidth }) => (
    <>
      <Rect x={3.4} y={5.4} width={17.2} height={13.2} rx={2} stroke={color} strokeWidth={strokeWidth} />
      <Path {...S('M3.4 15.4l4.4-4.2 3.6 3.4')} stroke={color} strokeWidth={strokeWidth} />
      <Circle cx={15.4} cy={9.8} r={1.4} stroke={color} strokeWidth={strokeWidth} />
    </>
  ),
  sparkle: ({ color, strokeWidth }) => (
    <>
      <Path {...S('M12 4.2v4.4')} stroke={color} strokeWidth={strokeWidth} />
      <Path {...S('M6.9 6.6l2.6 2.6')} stroke={color} strokeWidth={strokeWidth} />
      <Path {...S('M17.1 6.6l-2.6 2.6')} stroke={color} strokeWidth={strokeWidth} />
      <Circle cx={12} cy={15} r={3.4} stroke={color} strokeWidth={strokeWidth} />
    </>
  ),

  // ── Play types ──────────────────────────────────────────────────────────
  quiet: ({ color, strokeWidth }) => <Path {...S('M20.5 14.8A8.8 8.8 0 0 1 9.2 3.5 8.8 8.8 0 1 0 20.5 14.8Z')} stroke={color} strokeWidth={strokeWidth} />,
  active: ({ color, strokeWidth }) => (
    <>
      <Circle cx={13} cy={4.3} r={2.1} stroke={color} strokeWidth={strokeWidth} />
      <Path {...S('M13 6.4v6.1')} stroke={color} strokeWidth={strokeWidth} />
      <Path {...S('M13 12.5l-3.6 7.8')} stroke={color} strokeWidth={strokeWidth} />
      <Path {...S('M13 12.5l4 7.8')} stroke={color} strokeWidth={strokeWidth} />
      <Path {...S('M5.8 9.6l7.2 1.2 6.4-3')} stroke={color} strokeWidth={strokeWidth} />
    </>
  ),
  building: ({ color, strokeWidth }) => (
    <>
      <Rect x={3} y={13.5} width={8} height={7.5} rx={1.4} stroke={color} strokeWidth={strokeWidth} />
      <Rect x={13} y={13.5} width={8} height={7.5} rx={1.4} stroke={color} strokeWidth={strokeWidth} />
      <Rect x={8} y={4} width={8} height={7.5} rx={1.4} stroke={color} strokeWidth={strokeWidth} />
    </>
  ),
  creative: ({ color, strokeWidth }) => (
    <>
      <Path {...S('M4 20.2l.9-4 10.4-10.4a1.8 1.8 0 0 1 2.6 0l1 1a1.8 1.8 0 0 1 0 2.6L8.5 19.8l-4.5.4Z')} stroke={color} strokeWidth={strokeWidth} />
      <Path {...S('M13.6 7.1l3.3 3.3')} stroke={color} strokeWidth={strokeWidth} />
    </>
  ),
  pretend: ({ color, strokeWidth }) => <Path {...S('M3.2 7.8l4 3.2 4.8-6 4.8 6 4-3.2-1.8 11.4H5L3.2 7.8Z')} stroke={color} strokeWidth={strokeWidth} />,
  sensory: ({ color, strokeWidth }) => (
    <>
      <Path {...S('M12 20.5a3 3 0 0 1-3-3v-4a3 3 0 0 1 6 0v4a3 3 0 0 1-3 3Z')} stroke={color} strokeWidth={strokeWidth} />
      <Path {...S('M5.6 17.6V13a6.4 6.4 0 0 1 12.8 0v4.6')} stroke={color} strokeWidth={strokeWidth} />
      <Path {...S('M2.6 13.4a9.4 9.4 0 0 1 18.8 0')} stroke={color} strokeWidth={strokeWidth} />
    </>
  ),
  independent: ({ color, strokeWidth }) => (
    <>
      <Circle cx={12} cy={7.4} r={3.4} stroke={color} strokeWidth={strokeWidth} />
      <Path {...S('M5.4 20.4a6.6 6.6 0 0 1 13.2 0')} stroke={color} strokeWidth={strokeWidth} />
    </>
  ),
  together: ({ color, strokeWidth }) => (
    <>
      <Circle cx={8.6} cy={7.8} r={3} stroke={color} strokeWidth={strokeWidth} />
      <Circle cx={16.4} cy={9.4} r={2.4} stroke={color} strokeWidth={strokeWidth} />
      <Path {...S('M2.8 20.2a5.8 5.8 0 0 1 11.6 0')} stroke={color} strokeWidth={strokeWidth} />
      <Path {...S('M15.4 14.6a4.8 4.8 0 0 1 5.8 4.6')} stroke={color} strokeWidth={strokeWidth} />
    </>
  ),
  indoor: ({ color, strokeWidth }) => (
    <>
      <Path {...S('M3.4 10.2 12 3.6l8.6 6.6')} stroke={color} strokeWidth={strokeWidth} />
      <Path {...S('M5.4 11.6V19a1.4 1.4 0 0 0 1.4 1.4h10.4a1.4 1.4 0 0 0 1.4-1.4v-7.4')} stroke={color} strokeWidth={strokeWidth} />
      <Path {...S('M10 20.4v-5h4v5')} stroke={color} strokeWidth={strokeWidth} />
    </>
  ),
  outdoor: ({ color, strokeWidth }) => (
    <>
      <Circle cx={12} cy={10} r={4.2} stroke={color} strokeWidth={strokeWidth} />
      <Path {...S('M12 2.6v1.8')} stroke={color} strokeWidth={strokeWidth} />
      <Path {...S('M12 15.6v1.8')} stroke={color} strokeWidth={strokeWidth} />
      <Path {...S('M4.6 10h1.8')} stroke={color} strokeWidth={strokeWidth} />
      <Path {...S('M17.6 10h1.8')} stroke={color} strokeWidth={strokeWidth} />
      <Path {...S('M4 20.8h16')} stroke={color} strokeWidth={strokeWidth} />
    </>
  ),

  // ── Avatar characters ───────────────────────────────────────────────────
  bear: ({ color, strokeWidth }) => (
    <>
      <Circle cx={7} cy={6.4} r={2.6} stroke={color} strokeWidth={strokeWidth} />
      <Circle cx={17} cy={6.4} r={2.6} stroke={color} strokeWidth={strokeWidth} />
      <Circle cx={12} cy={13.4} r={7.2} stroke={color} strokeWidth={strokeWidth} />
      <Circle cx={9.4} cy={12} r={1} stroke={color} strokeWidth={strokeWidth} />
      <Circle cx={14.6} cy={12} r={1} stroke={color} strokeWidth={strokeWidth} />
      <Path {...S('M12 15.2a2.3 2.3 0 0 0 2-1.1M12 15.2a2.3 2.3 0 0 1-2-1.1')} stroke={color} strokeWidth={strokeWidth} />
    </>
  ),
  chick: ({ color, strokeWidth }) => (
    <>
      <Path {...S('M5.6 10.4L4.8 4.6l4.6 3.2a8 8 0 0 1 5.2 0l4.6-3.2-.8 5.8')} stroke={color} strokeWidth={strokeWidth} />
      <Path {...S('M19.4 12.6a7.4 7.4 0 1 1-14.8 0 7.4 7.4 0 0 1 14.8 0Z')} stroke={color} strokeWidth={strokeWidth} />
      <Circle cx={9.6} cy={12.6} r={1} stroke={color} strokeWidth={strokeWidth} />
      <Circle cx={14.4} cy={12.6} r={1} stroke={color} strokeWidth={strokeWidth} />
      <Path {...S('M17.6 15h3M3.4 15h3')} stroke={color} strokeWidth={strokeWidth} />
    </>
  ),
  star: ({ color, strokeWidth }) => <Path {...S('M12 3.4l2.7 5.5 6 .9-4.3 4.3 1 6-5.4-2.9-5.4 2.9 1-6L3.3 9.8l6-.9Z')} stroke={color} strokeWidth={strokeWidth} />,
  fish: ({ color, strokeWidth }) => (
    <>
      <Path {...S('M14.6 12c0 4-3.9 6.6-7.6 6.6-1.4 0-2.7-.4-3.6-1 1.1-1.5 1.7-3.5 1.7-5.6 0-2.1-.6-4.1-1.7-5.6.9-.6 2.2-1 3.6-1 3.7 0 7.6 2.6 7.6 6.6Z')} stroke={color} strokeWidth={strokeWidth} />
      <Path {...S('M14.6 12l6 4.4V7.6L14.6 12Z')} stroke={color} strokeWidth={strokeWidth} />
      <Circle cx={8.4} cy={10.6} r={1} stroke={color} strokeWidth={strokeWidth} />
    </>
  ),
  balloon: ({ color, strokeWidth }) => (
    <>
      <Path {...S('M12 13.6c3.4 0 6.2-2.6 6.2-5.6S15.4 2.4 12 2.4 5.8 5 5.8 8s2.8 5.6 6.2 5.6Z')} stroke={color} strokeWidth={strokeWidth} />
      <Path {...S('M12 13.6v2.6')} stroke={color} strokeWidth={strokeWidth} />
      <Path {...S('M12 16.2c1.4 1.2 1.4 2.6 0 3.4-1.4.8-1.4 1.4 0 2')} stroke={color} strokeWidth={strokeWidth} />
    </>
  ),
  cat: ({ color, strokeWidth }) => (
    <>
      <Path {...S('M5.4 9.6 4.6 3.8l4.8 3.4a8.6 8.6 0 0 1 5.2 0l4.8-3.4-.8 5.8')} stroke={color} strokeWidth={strokeWidth} />
      <Path {...S('M19.6 13a7.6 7.6 0 1 1-15.2 0 7.6 7.6 0 0 1 15.2 0Z')} stroke={color} strokeWidth={strokeWidth} />
      <Circle cx={9.4} cy={12.4} r={1} stroke={color} strokeWidth={strokeWidth} />
      <Circle cx={14.6} cy={12.4} r={1} stroke={color} strokeWidth={strokeWidth} />
      <Path {...S('M12 15v1.2')} stroke={color} strokeWidth={strokeWidth} />
      <Path {...S('M16.4 14h3.8M3.8 14h3.8')} stroke={color} strokeWidth={strokeWidth} />
    </>
  ),
  rocket: ({ color, strokeWidth }) => (
    <>
      <Path {...S('M12 2.6c3 2.4 4.6 5.8 4.6 9.4l-1.8 4.4H9.2L7.4 12C7.4 8.4 9 5 12 2.6Z')} stroke={color} strokeWidth={strokeWidth} />
      <Circle cx={12} cy={10} r={1.9} stroke={color} strokeWidth={strokeWidth} />
      <Path {...S('M7.6 13.4 4.6 16v3.4l3.4-1.8M16.4 13.4l3 2.6v3.4l-3.4-1.8')} stroke={color} strokeWidth={strokeWidth} />
      <Path {...S('M12 18.4v2.8')} stroke={color} strokeWidth={strokeWidth} />
    </>
  ),
  flower: ({ color, strokeWidth }) => (
    <>
      <Circle cx={12} cy={8.6} r={2.3} stroke={color} strokeWidth={strokeWidth} />
      <Path {...S('M12 6.3a2.6 2.6 0 1 1 0-2.2M14.3 8.6a2.6 2.6 0 1 1 2.1 1.3M9.7 8.6a2.6 2.6 0 1 0-2.1 1.3M10.4 10.5a2.6 2.6 0 1 0 1.6 2.2M13.6 10.5a2.6 2.6 0 1 1-1.6 2.2')} stroke={color} strokeWidth={strokeWidth} />
      <Path {...S('M12 13.8v7.4')} stroke={color} strokeWidth={strokeWidth} />
      <Path {...S('M12 17.6c-2 0-3.4-1.2-3.4-2.8 1.8-.4 3.4.8 3.4 2.8Z')} stroke={color} strokeWidth={strokeWidth} />
    </>
  ),
};

export const PIP_ICON_NAMES = Object.keys(glyphs) as PipIconName[];

export type PipIconProps = {
  name: PipIconName;
  /** Rendered square size in points. Defaults to the design's 24pt. */
  size?: number;
  color?: string;
  /**
   * Stroke width on the 24-unit grid. The design draws navigation at 2 and
   * play-type glyphs at 1.9; both hold up down to 18pt.
   */
  strokeWidth?: number;
} & Pick<SvgProps, 'accessibilityLabel'>;

/**
 * Icons are decorative by default: they sit beside a visible label, so a
 * screen reader that announced them too would read everything twice. Pass an
 * `accessibilityLabel` only when the icon is genuinely the only label.
 */
export const PipIcon = memo(function PipIcon({
  name,
  size = 24,
  color = theme.colors.secondaryText,
  strokeWidth = 2,
  accessibilityLabel,
}: PipIconProps) {
  const glyph = glyphs[name]({ color, strokeWidth });
  return (
    <View
      accessibilityElementsHidden={!accessibilityLabel}
      importantForAccessibility={accessibilityLabel ? 'yes' : 'no-hide-descendants'}
      style={{ height: size, width: size }}
    >
      <Svg
        accessibilityLabel={accessibilityLabel}
        fill="none"
        height={size}
        role={accessibilityLabel ? 'img' : undefined}
        strokeLinecap="round"
        strokeLinejoin="round"
        viewBox="0 0 24 24"
        width={size}
      >
        {glyph}
      </Svg>
    </View>
  );
});
