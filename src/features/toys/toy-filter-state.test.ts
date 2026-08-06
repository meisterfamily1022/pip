import type { LocationTreeItem } from '@/features/locations/location-service';
import { countActiveToyFilters, resetToyFilters, toyFilterLabels } from './toy-filter-state';

const locations = [
  { id: 1, name: 'Playroom', createdAt: '', updatedAt: '', storageSpots: [{ id: 2, roomId: 1, name: 'Mint Basket', createdAt: '', updatedAt: '' }] },
] satisfies LocationTreeItem[];

describe('Toy Library filter state', () => {
  it('starts and resets with no active user filters', () => {
    expect(countActiveToyFilters(resetToyFilters())).toBe(0);
    expect(toyFilterLabels(resetToyFilters(), locations)).toEqual([]);
  });

  it('reports one active filter', () => {
    const filters = { ...resetToyFilters(), category: 'quiet' as const };
    expect(countActiveToyFilters(filters)).toBe(1);
    expect(toyFilterLabels(filters, locations)).toEqual(['Category: Quiet']);
  });

  it('reports multiple actual model filters and their visible labels', () => {
    const filters = { ...resetToyFilters(), roomId: 1, storageSpotId: 2, cleanupDifficulty: 'big' as const, adultHelpRequired: true, availability: 'hidden' as const };
    expect(countActiveToyFilters(filters)).toBe(5);
    expect(toyFilterLabels(filters, locations)).toEqual(['Room: Playroom', 'Storage: Mint Basket', 'Big cleanup', 'Adult help required', 'Hidden from child']);
  });

  it('clears search and every applied filter on reset', () => {
    const reset = resetToyFilters();
    expect(reset).toEqual({ archived: 'active', availability: 'all' });
    expect(reset).not.toHaveProperty('search');
    expect(reset).not.toHaveProperty('storageSpotId');
  });
});
