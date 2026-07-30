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

/** Parent-facing category names, as listed in the V1 scope. */
export const PLAY_CATEGORY_LABELS: Record<PlayCategory, string> = {
  quiet: 'Quiet',
  active: 'Active',
  creative: 'Creative',
  building: 'Building',
  pretend: 'Pretend',
  sensory: 'Sensory',
  independent: 'Independent',
  together: 'Play Together',
  indoor: 'Indoor',
  outdoor: 'Outdoor',
};

export function playCategoryLabel(category: PlayCategory): string {
  return PLAY_CATEGORY_LABELS[category];
}
