import type { ChoiceLimit } from '@/domain/models';
import type { PlayCategory } from '@/domain/play-category';
import type { ChildToy } from '@/repositories/toys-repository';

export type PlayType = PlayCategory | 'anything';
export type RecommendationOptions = { category: PlayType; choiceLimit: number; dismissedIds?: readonly number[]; recentIds?: readonly number[] };

export function safeChoiceLimit(value: number | null | undefined): ChoiceLimit {
  return value === 1 || value === 5 ? value : 3;
}

function eligible(toys: readonly ChildToy[], category: PlayType): ChildToy[] {
  return toys.filter((toy) => toy.isAvailable && !toy.isArchived && toy.roomName.length > 0 && toy.storageSpotName.length > 0 && (category === 'anything' || toy.categories.includes(category)));
}

function shuffled(toys: readonly ChildToy[]): ChildToy[] {
  return [...toys].sort(() => Math.random() - 0.5);
}

export function recommendToys(toys: readonly ChildToy[], options: RecommendationOptions): ChildToy[] {
  const limit = safeChoiceLimit(options.choiceLimit);
  const matching = eligible(toys, options.category);
  const dismissed = new Set(options.dismissedIds ?? []);
  const recent = new Set(options.recentIds ?? []);
  const preferred = matching.filter((toy) => !dismissed.has(toy.id) && !recent.has(toy.id));
  const withoutDismissed = matching.filter((toy) => !dismissed.has(toy.id));
  const pool = preferred.length >= limit ? preferred : withoutDismissed.length >= limit ? withoutDismissed : matching;
  return shuffled(pool).filter((toy, index, all) => all.findIndex((candidate) => candidate.id === toy.id) === index).slice(0, limit);
}

export function surpriseToy(toys: readonly ChildToy[]): ChildToy | null {
  return recommendToys(toys, { category: 'anything', choiceLimit: 1 })[0] ?? null;
}
