import type { PlayCategory } from '@/domain/play-category';

export type ToyBatchDraft = { id: string; uri: string; name: string; roomId: number | null; storageSpotId: number | null; categories: PlayCategory[]; isAvailable: boolean };
export type IntakeAsset = { uri: string; mimeType?: string | null; fileSize?: number | null };
export const MAX_TOY_IMAGE_BYTES = 15 * 1024 * 1024;

export function validateIntakeAsset(asset: IntakeAsset): string | null {
  if (!asset.uri) return 'This image has no usable location.';
  if (asset.mimeType && !asset.mimeType.startsWith('image/')) return 'Only image files can be added.';
  if (asset.fileSize && asset.fileSize > MAX_TOY_IMAGE_BYTES) return 'This image is larger than 15 MB.';
  return null;
}
export function createToyBatchDrafts(assets: readonly IntakeAsset[], startAt = 0): { drafts: ToyBatchDraft[]; rejected: string[] } {
  const drafts: ToyBatchDraft[] = []; const rejected: string[] = [];
  assets.forEach((asset, index) => { const error = validateIntakeAsset(asset); if (error) { rejected.push(error); return; } drafts.push({ id: `${Date.now()}-${startAt + index}-${Math.random().toString(36).slice(2)}`, uri: asset.uri, name: `New toy ${startAt + index + 1}`, roomId: null, storageSpotId: null, categories: [], isAvailable: true }); });
  return { drafts, rejected };
}
export function applyBatchMetadata(drafts: readonly ToyBatchDraft[], patch: Partial<Pick<ToyBatchDraft, 'roomId' | 'storageSpotId' | 'categories' | 'isAvailable'>>): ToyBatchDraft[] { return drafts.map((draft) => ({ ...draft, ...patch, categories: patch.categories ? [...patch.categories] : draft.categories })); }
export function updateBatchDraft(drafts: readonly ToyBatchDraft[], id: string, patch: Partial<ToyBatchDraft>): ToyBatchDraft[] { return drafts.map((draft) => draft.id === id ? { ...draft, ...patch, categories: patch.categories ? [...patch.categories] : draft.categories } : draft); }
export function removeBatchDraft(drafts: readonly ToyBatchDraft[], id: string): ToyBatchDraft[] { return drafts.filter((draft) => draft.id !== id); }
