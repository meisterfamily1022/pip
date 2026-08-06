import Svg, { Circle, G, Line, Path, Polyline, Rect } from 'react-native-svg';

import { colors } from './tokens';

/**
 * Icon set transcribed from the "PlayMap Redesign" design canvas.
 *
 * Every icon draws on a 24x24 viewBox and inherits its colour from `color`,
 * so a caller can tint an icon to match the tile it sits on.
 */

export type IconProps = {
  size?: number;
  color?: string;
};

type Icon = (props: IconProps) => React.JSX.Element;

const base = ({ size = 24, color = colors.textPrimary }: IconProps) => ({
  width: size,
  height: size,
  viewBox: '0 0 24 24',
  fill: 'none',
  color,
});

export const ToyBoxIcon: Icon = (props) => {
  const { color, ...svg } = base(props);
  return (
    <Svg {...svg}>
      <Path d="M4 8l8-4 8 4" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
      <Rect x={4} y={8} width={16} height={12} rx={1.5} stroke={color} strokeWidth={1.8} />
    </Svg>
  );
};

/** Toy box with a divider line — used by empty states. */
export const ToyBoxEmptyIcon: Icon = (props) => {
  const { color, ...svg } = base(props);
  return (
    <Svg {...svg}>
      <Path d="M4 8l8-4 8 4" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
      <Rect x={4} y={8} width={16} height={12} rx={1.5} stroke={color} strokeWidth={1.8} />
      <Line x1={4} y1={13} x2={20} y2={13} stroke={color} strokeWidth={1.6} />
    </Svg>
  );
};

export const HouseIcon: Icon = (props) => {
  const { color, ...svg } = base(props);
  return (
    <Svg {...svg}>
      <Path d="M4 11.5L12 5l8 6.5" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M6 10v9a1 1 0 001 1h10a1 1 0 001-1v-9" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
};

export const SparkleIcon: Icon = (props) => {
  const { color, ...svg } = base(props);
  return (
    <Svg {...svg}>
      <Path d="M12 3v6M12 15v6M3 12h6M15 12h6" stroke={color} strokeWidth={1.8} strokeLinecap="round" />
      <Path d="M7 7l2 2M15 15l2 2M17 7l-2 2M7 17l2-2" stroke={color} strokeWidth={1.4} strokeLinecap="round" />
    </Svg>
  );
};

export const SlidersIcon: Icon = (props) => {
  const { color, ...svg } = base(props);
  return (
    <Svg {...svg}>
      <Line x1={4} y1={7} x2={20} y2={7} stroke={color} strokeWidth={1.8} />
      <Circle cx={9} cy={7} r={2.2} fill={color} />
      <Line x1={4} y1={12} x2={20} y2={12} stroke={color} strokeWidth={1.8} />
      <Circle cx={16} cy={12} r={2.2} fill={color} />
      <Line x1={4} y1={17} x2={20} y2={17} stroke={color} strokeWidth={1.8} />
      <Circle cx={11} cy={17} r={2.2} fill={color} />
    </Svg>
  );
};

export const ChevronRightIcon: Icon = (props) => {
  const { color, ...svg } = base(props);
  return (
    <Svg {...svg}>
      <Path d="M9 6l6 6-6 6" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
};

export const ChevronLeftIcon: Icon = (props) => {
  const { color, ...svg } = base(props);
  return (
    <Svg {...svg}>
      <Path d="M15 6l-6 6 6 6" stroke={color} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
};

export const PlusIcon: Icon = (props) => {
  const { color, ...svg } = base(props);
  return (
    <Svg {...svg}>
      <Line x1={12} y1={5} x2={12} y2={19} stroke={color} strokeWidth={2.4} strokeLinecap="round" />
      <Line x1={5} y1={12} x2={19} y2={12} stroke={color} strokeWidth={2.4} strokeLinecap="round" />
    </Svg>
  );
};

export const CameraIcon: Icon = (props) => {
  const { color, ...svg } = base(props);
  return (
    <Svg {...svg}>
      <Rect x={3} y={7} width={18} height={13} rx={2} stroke={color} strokeWidth={1.8} />
      <Path d="M8 7l1.5-2h5L16 7" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
      <Circle cx={12} cy={13} r={3.5} stroke={color} strokeWidth={1.8} />
    </Svg>
  );
};

export const SearchIcon: Icon = (props) => {
  const { color, ...svg } = base(props);
  return (
    <Svg {...svg}>
      <Circle cx={10.5} cy={10.5} r={6} stroke={color} strokeWidth={1.8} />
      <Line x1={15.5} y1={15.5} x2={20} y2={20} stroke={color} strokeWidth={1.8} strokeLinecap="round" />
    </Svg>
  );
};

export const FilterIcon: Icon = (props) => {
  const { color, ...svg } = base(props);
  return (
    <Svg {...svg}>
      <Path d="M4 5h16l-6 7v6l-4 2v-8z" stroke={color} strokeWidth={1.6} strokeLinejoin="round" />
    </Svg>
  );
};

export const PencilIcon: Icon = (props) => {
  const { color, ...svg } = base(props);
  return (
    <Svg {...svg}>
      <Path d="M4 20l1-4L16 5l3 3L8 19l-4 1z" stroke={color} strokeWidth={1.6} strokeLinejoin="round" />
    </Svg>
  );
};

export const TrashIcon: Icon = (props) => {
  const { color, ...svg } = base(props);
  return (
    <Svg {...svg}>
      <Path
        d="M5 7h14M9 7V5a1 1 0 011-1h4a1 1 0 011 1v2m-9 0l1 12a1 1 0 001 1h8a1 1 0 001-1l1-12"
        stroke={color}
        strokeWidth={1.6}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
};

export const HideIcon: Icon = (props) => {
  const { color, ...svg } = base(props);
  return (
    <Svg {...svg}>
      <Circle cx={12} cy={12} r={7} stroke={color} strokeWidth={1.6} />
      <Circle cx={12} cy={12} r={2.4} fill={color} />
      <Line x1={4} y1={20} x2={20} y2={4} stroke={color} strokeWidth={1.6} />
    </Svg>
  );
};

export const ArchiveIcon: Icon = (props) => {
  const { color, ...svg } = base(props);
  return (
    <Svg {...svg}>
      <Rect x={4} y={5} width={16} height={4} rx={1} stroke={color} strokeWidth={1.6} />
      <Rect x={5} y={9} width={14} height={10} rx={1} stroke={color} strokeWidth={1.6} />
      <Line x1={10} y1={13} x2={14} y2={13} stroke={color} strokeWidth={1.6} strokeLinecap="round" />
    </Svg>
  );
};

/** The room → storage spot separator arrow. */
export const LocationArrowIcon: Icon = (props) => {
  const { color, ...svg } = base(props);
  return (
    <Svg {...svg}>
      <Line x1={6} y1={12} x2={18} y2={12} stroke={color} strokeWidth={1.8} />
      <Polyline points="14,7 18,12 14,17" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
};

export const CheckIcon: Icon = (props) => {
  const { color, ...svg } = base(props);
  return (
    <Svg {...svg}>
      <Polyline points="5,13 9,17 19,7" stroke={color} strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
};

export const LockIcon: Icon = (props) => {
  const { color, ...svg } = base(props);
  return (
    <Svg {...svg}>
      <Rect x={5} y={11} width={14} height={9} rx={2} stroke={color} strokeWidth={1.8} />
      <Path d="M8 11V8a4 4 0 018 0v3" stroke={color} strokeWidth={1.8} />
    </Svg>
  );
};

export const BookIcon: Icon = (props) => {
  const { color, ...svg } = base(props);
  return (
    <Svg {...svg}>
      <Rect x={5} y={4} width={14} height={16} rx={1.5} stroke={color} strokeWidth={1.7} />
      <Line x1={12} y1={4} x2={12} y2={20} stroke={color} strokeWidth={1.7} />
    </Svg>
  );
};

export const BoltIcon: Icon = (props) => {
  const { color, ...svg } = base(props);
  return (
    <Svg {...svg}>
      <Path d="M13 3L5 14h6l-2 7 8-11h-6l2-7z" fill={color} />
    </Svg>
  );
};

export const BlocksIcon: Icon = (props) => {
  const { color, ...svg } = base(props);
  return (
    <Svg {...svg}>
      <Rect x={4} y={4} width={7} height={7} rx={1} stroke={color} strokeWidth={1.7} />
      <Rect x={13} y={4} width={7} height={7} rx={1} stroke={color} strokeWidth={1.7} />
      <Rect x={4} y={13} width={7} height={7} rx={1} stroke={color} strokeWidth={1.7} />
      <Rect x={13} y={13} width={7} height={7} rx={1} stroke={color} strokeWidth={1.7} />
    </Svg>
  );
};

export const BrushStrokeIcon: Icon = (props) => {
  const { color, ...svg } = base(props);
  return (
    <Svg {...svg}>
      <Path d="M3 15c2-5 4 5 6 0s4-5 6 0 4 5 6 0" stroke={color} strokeWidth={1.8} strokeLinecap="round" />
    </Svg>
  );
};

export const SmileIcon: Icon = (props) => {
  const { color, ...svg } = base(props);
  return (
    <Svg {...svg}>
      <Circle cx={12} cy={12} r={8} stroke={color} strokeWidth={1.7} />
      <Circle cx={9} cy={10} r={1} fill={color} />
      <Circle cx={15} cy={10} r={1} fill={color} />
      <Path d="M8 15q4 3 8 0" stroke={color} strokeWidth={1.6} strokeLinecap="round" />
    </Svg>
  );
};

export const WavesIcon: Icon = (props) => {
  const { color, ...svg } = base(props);
  return (
    <Svg {...svg}>
      <Path d="M4 8q4-3 8 0t8 0" stroke={color} strokeWidth={1.7} strokeLinecap="round" />
      <Path d="M4 12q4-3 8 0t8 0" stroke={color} strokeWidth={1.7} strokeLinecap="round" />
      <Path d="M4 16q4-3 8 0t8 0" stroke={color} strokeWidth={1.7} strokeLinecap="round" />
    </Svg>
  );
};

export const PersonIcon: Icon = (props) => {
  const { color, ...svg } = base(props);
  return (
    <Svg {...svg}>
      <Circle cx={12} cy={8} r={3.2} stroke={color} strokeWidth={1.7} />
      <Path d="M6 20c0-3.3 2.7-6 6-6s6 2.7 6 6" stroke={color} strokeWidth={1.7} strokeLinecap="round" />
    </Svg>
  );
};

export const PeopleIcon: Icon = (props) => {
  const { color, ...svg } = base(props);
  return (
    <Svg {...svg}>
      <Circle cx={8.5} cy={9} r={2.6} stroke={color} strokeWidth={1.6} />
      <Circle cx={16} cy={9.5} r={2.2} stroke={color} strokeWidth={1.6} />
      <Path d="M4 19c0-2.8 2.2-5 5-5s5 2.2 5 5" stroke={color} strokeWidth={1.6} strokeLinecap="round" />
      <Path d="M13.5 15.2c2.3.3 4 2.1 4 3.8" stroke={color} strokeWidth={1.6} strokeLinecap="round" />
    </Svg>
  );
};

export const SunIcon: Icon = (props) => {
  const { color, ...svg } = base(props);
  return (
    <Svg {...svg}>
      <Circle cx={12} cy={9} r={6} stroke={color} strokeWidth={1.7} />
      <Rect x={11} y={15} width={2} height={5} fill={color} />
    </Svg>
  );
};

export const DiceIcon: Icon = (props) => {
  const { color, ...svg } = base(props);
  return (
    <Svg {...svg}>
      <Rect x={4} y={4} width={16} height={16} rx={3} stroke={color} strokeWidth={1.6} />
      <Circle cx={8} cy={8} r={1.6} fill={color} />
      <Circle cx={16} cy={8} r={1.6} fill={color} />
      <Circle cx={12} cy={12} r={1.6} fill={color} />
      <Circle cx={8} cy={16} r={1.6} fill={color} />
      <Circle cx={16} cy={16} r={1.6} fill={color} />
    </Svg>
  );
};

/** The small rotated square that precedes the PARENT MODE / CHILD MODE label. */
export const ModeDiamondIcon: Icon = ({ size = 9, color = colors.terracotta }: IconProps) => (
  <Svg width={size} height={size} viewBox="0 0 24 24">
    <G transform="rotate(45 12 12)">
      <Rect x={4} y={4} width={16} height={16} rx={2} fill={color} />
    </G>
  </Svg>
);

/** Two-tone child illustration used in the Child Home hero band. */
export const ChildHeroIcon = ({ size = 46 }: { size?: number }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Path d="M6 20c0-3.3 2.7-6 6-6s6 2.7 6 6" stroke={colors.terracotta} strokeWidth={1.8} strokeLinecap="round" />
    <Circle cx={12} cy={8} r={3.2} stroke={colors.green} strokeWidth={1.8} />
  </Svg>
);
