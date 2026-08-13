import type { ChildToy } from '@/repositories/toys-repository';
import { recommendToys, safeChoiceLimit, surpriseToy } from './recommendation-service';

const toy = (id: number, categories: ChildToy['categories'], available = true, archived = false): ChildToy => ({ id, name: `Toy ${id}`, imageUri: null, originalImageUri: null, enhancedImageUri: null, preferredImageVariant: 'original', aiMetadataStatus: 'manual', aiAnalysisId: null, aiSchemaVersion: null, aiConsentAt: null, aiConfirmedAt: null, roomId: 1, storageSpotId: 1, cleanupDifficulty: 'easy', adultHelpRequired: false, categories, isAvailable: available, isArchived: archived, createdAt: '', updatedAt: '', roomName: 'Room', storageSpotName: 'Shelf' });
const toys = [toy(1, ['quiet']), toy(2, ['quiet', 'building']), toy(3, ['active']), toy(4, ['quiet'], false), toy(5, ['quiet'], true, true)];

describe('child recommendation service', () => {
  it('filters hidden and archived toys and matches categories', () => {
    expect(recommendToys(toys, { category: 'quiet', choiceLimit: 5 }).map((item) => item.id).sort()).toEqual([1, 2]);
    expect(recommendToys(toys, { category: 'anything', choiceLimit: 5 }).map((item) => item.id).sort()).toEqual([1, 2, 3]);
  });

  it('keeps toys with partial location metadata eligible', () => {
    const partial = { ...toy(8, ['quiet']), roomName: '', storageSpotName: 'Shelf' };
    expect(recommendToys([partial], { category: 'quiet', choiceLimit: 1 })).toEqual([partial]);
  });

  it.each([1, 3, 5] as const)('honors choice limit %i', (limit) => {
    expect(recommendToys([1, 2, 3, 4, 5].map((id) => toy(id, ['quiet'])), { category: 'quiet', choiceLimit: limit })).toHaveLength(limit);
  });

  it('defaults invalid limits to three', () => {
    expect(safeChoiceLimit(2)).toBe(3);
    expect(recommendToys([1, 2, 3, 4].map((id) => toy(id, ['quiet'])), { category: 'quiet', choiceLimit: 99 })).toHaveLength(3);
  });

  it('avoids dismissed toys when alternatives exist and reuses only when needed', () => {
    expect(recommendToys([1, 2, 3].map((id) => toy(id, ['quiet'])), { category: 'quiet', choiceLimit: 1, dismissedIds: [1, 2] }).map((item) => item.id)).toEqual([3]);
    expect(recommendToys([1].map((id) => toy(id, ['quiet'])), { category: 'quiet', choiceLimit: 1, dismissedIds: [1] }).map((item) => item.id)).toEqual([1]);
  });

  it('returns one eligible toy for Surprise Me and null when empty', () => {
    expect(surpriseToy(toys)?.id).toBeDefined();
    expect(surpriseToy([])).toBeNull();
  });
});
