import {
  BlocksIcon,
  BoltIcon,
  BookIcon,
  BrushStrokeIcon,
  DiceIcon,
  HouseIcon,
  PeopleIcon,
  PersonIcon,
  SmileIcon,
  SunIcon,
  WavesIcon,
  type IconProps,
} from '@/design/icons';
import type { Tint } from '@/design/primitives';
import type { PlayCategory } from '@/domain/play-category';

/**
 * The child-facing play choices from the design's Categories screen.
 *
 * Each choice maps to one stored `PlayCategory`, except "Show me anything",
 * whose `category` is null and which suggests from the whole library.
 */
export type PlayChoice = {
  /** Stable slug used in navigation params. */
  id: string;
  label: string;
  category: PlayCategory | null;
  tint: Tint;
  icon: (props: IconProps) => React.JSX.Element;
};

export const PLAY_CHOICES: readonly PlayChoice[] = [
  { id: 'quiet', label: 'Something quiet', category: 'quiet', tint: 'mint', icon: BookIcon },
  { id: 'active', label: 'Something active', category: 'active', tint: 'peach', icon: BoltIcon },
  { id: 'build', label: 'Build something', category: 'building', tint: 'butter', icon: BlocksIcon },
  { id: 'make', label: 'Make something', category: 'creative', tint: 'lilac', icon: BrushStrokeIcon },
  { id: 'pretend', label: 'Pretend', category: 'pretend', tint: 'peach', icon: SmileIcon },
  { id: 'sensory', label: 'Something sensory', category: 'sensory', tint: 'mint', icon: WavesIcon },
  { id: 'solo', label: 'Play by myself', category: 'independent', tint: 'lilac', icon: PersonIcon },
  { id: 'together', label: 'Play together', category: 'together', tint: 'butter', icon: PeopleIcon },
  { id: 'inside', label: 'Play inside', category: 'indoor', tint: 'mint', icon: HouseIcon },
  { id: 'outside', label: 'Play outside', category: 'outdoor', tint: 'peach', icon: SunIcon },
  { id: 'anything', label: 'Show me anything', category: null, tint: 'butter', icon: DiceIcon },
];

export const ANYTHING_CHOICE_ID = 'anything';

export function findPlayChoice(id: string | undefined): PlayChoice {
  return PLAY_CHOICES.find((choice) => choice.id === id) ?? PLAY_CHOICES[PLAY_CHOICES.length - 1];
}
