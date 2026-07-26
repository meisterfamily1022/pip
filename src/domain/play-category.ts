export const PLAY_CATEGORIES = [
  'quiet',
  'active',
  'creative',
  'building',
  'pretend',
  'sensory',
  'independent',
  'together',
  'indoor',
  'outdoor',
] as const;

export type PlayCategory = (typeof PLAY_CATEGORIES)[number];

export function isPlayCategory(value: string): value is PlayCategory {
  return PLAY_CATEGORIES.includes(value as PlayCategory);
}
