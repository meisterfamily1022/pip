import type { Toy } from '@/domain/models';
import type { LocationTreeItem } from '@/features/locations/location-service';
import type { ToyFilters } from '@/repositories/toys-repository';

export const DEFAULT_TOY_FILTERS: Readonly<ToyFilters> = {
  archived: 'active',
  availability: 'all',
};

export function resetToyFilters(): ToyFilters {
  return { ...DEFAULT_TOY_FILTERS };
}

export function countActiveToyFilters(filters: ToyFilters): number {
  return [
    Boolean(filters.search?.trim()),
    Boolean(filters.roomId),
    Boolean(filters.storageSpotId),
    Boolean(filters.category),
    Boolean(filters.cleanupDifficulty),
    filters.adultHelpRequired !== undefined && filters.adultHelpRequired !== null,
    filters.availability !== undefined && filters.availability !== 'all',
    filters.archived !== undefined && filters.archived !== 'active',
  ].filter(Boolean).length;
}

export function toyFilterLabels(filters: ToyFilters, locations: readonly LocationTreeItem[]): string[] {
  const labels: string[] = [];
  const room = locations.find((candidate) => candidate.id === filters.roomId);
  const spot = locations.flatMap((candidate) => candidate.storageSpots).find((candidate) => candidate.id === filters.storageSpotId);
  if (filters.search?.trim()) labels.push(`Name: ${filters.search.trim()}`);
  if (room) labels.push(`Room: ${room.name}`);
  if (spot) labels.push(`Storage: ${spot.name}`);
  if (filters.category) labels.push(`Category: ${filters.category[0]?.toUpperCase()}${filters.category.slice(1)}`);
  if (filters.cleanupDifficulty) labels.push(cleanupDifficultyLabel(filters.cleanupDifficulty));
  if (filters.adultHelpRequired === true) labels.push('Adult help required');
  if (filters.adultHelpRequired === false) labels.push('No adult help');
  if (filters.availability === 'available') labels.push('Visible to child');
  if (filters.availability === 'hidden') labels.push('Hidden from child');
  if (filters.archived === 'archived') labels.push('Archived');
  if (filters.archived === 'all') labels.push('Archived + active');
  return labels;
}

export function cleanupDifficultyLabel(value: Toy['cleanupDifficulty']): string {
  return value === 'big' ? 'Big cleanup' : `${value[0]?.toUpperCase()}${value.slice(1)} cleanup`;
}
