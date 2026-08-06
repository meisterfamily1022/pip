import type { DatabaseConnection } from '@/database/types';
import type { ToySetupDraft } from '@/domain/models';
import type { PlayCategory } from '@/domain/play-category';
import { getParentToyByIntakeKey } from '@/repositories/toys-repository';

import { createParentToysBulk, type BulkToyRecord } from './toy-service';
import { expoToyImageStorage, type ToyImageStorage } from './toy-image-storage';
import { createToySetupDraft, getToySetupDraft, listToySetupDrafts, updateToySetupDraft, type ToySetupDraftUpdate } from './toy-setup-draft-repository';
import { discardToySetupDraft } from './toy-setup-draft-service';

export type IntakeDraftPatch = {
  name?: string;
  roomId?: number | null;
  storageSpotId?: number | null;
  categories?: readonly PlayCategory[];
  cleanupDifficulty?: 'easy' | 'medium' | 'big';
  adultHelpRequired?: boolean;
  isAvailable?: boolean;
};

export type IntakeQueueSummary = {
  total: number;
  completed: number;
  incomplete: number;
  failed: number;
};

export function intakeDraftIdForSource(sourceUri: string): string {
  let hash = 2166136261;
  for (let index = 0; index < sourceUri.length; index += 1) {
    hash ^= sourceUri.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return `intake-${sourceUri.length}-${(hash >>> 0).toString(36)}`;
}

export function applyIntakeDraftPatch(draft: ToySetupDraft, patch: IntakeDraftPatch): ToySetupDraft {
  return {
    ...draft,
    draftName: 'name' in patch ? patch.name?.trim() ? patch.name : null : draft.draftName,
    roomId: 'roomId' in patch ? patch.roomId ?? null : draft.roomId,
    storageSpotId: 'storageSpotId' in patch ? patch.storageSpotId ?? null : draft.storageSpotId,
    categoriesJson: 'categories' in patch ? JSON.stringify(patch.categories ?? []) : draft.categoriesJson,
    cleanupDifficultyDraft: 'cleanupDifficulty' in patch ? patch.cleanupDifficulty ?? 'easy' : draft.cleanupDifficultyDraft,
    adultHelpRequiredDraft: 'adultHelpRequired' in patch ? patch.adultHelpRequired ?? false : draft.adultHelpRequiredDraft,
    isAvailableDraft: 'isAvailable' in patch ? patch.isAvailable ?? true : draft.isAvailableDraft,
    saveError: null,
  };
}

export function draftCategories(draft: ToySetupDraft): PlayCategory[] {
  try {
    const value: unknown = JSON.parse(draft.categoriesJson);
    return Array.isArray(value) ? value.filter((item): item is PlayCategory => typeof item === 'string') : [];
  } catch {
    return [];
  }
}

export function intakeDraftErrors(draft: ToySetupDraft): string[] {
  const errors: string[] = [];
  if (!draft.draftName?.trim()) errors.push('Enter a toy name.');
  if (!draft.roomId) errors.push('Choose a room.');
  if (!draft.storageSpotId) errors.push('Choose a storage spot.');
  if (draftCategories(draft).length === 0) errors.push('Choose at least one category.');
  return errors;
}

export function summarizeIntakeQueue(drafts: readonly ToySetupDraft[]): IntakeQueueSummary {
  return {
    total: drafts.length,
    completed: drafts.filter((draft) => draft.savedToyId !== null).length,
    incomplete: drafts.filter((draft) => draft.savedToyId === null && !draft.saveError && intakeDraftErrors(draft).length > 0).length,
    failed: drafts.filter((draft) => draft.savedToyId === null && Boolean(draft.saveError)).length,
  };
}

export async function addImagesToIntakeQueue(
  database: DatabaseConnection,
  sourceUris: readonly string[],
  storage: ToyImageStorage = expoToyImageStorage,
  yieldToUi: () => Promise<void> = () => new Promise((resolve) => setTimeout(resolve, 0)),
): Promise<{ drafts: ToySetupDraft[]; failures: string[] }> {
  const drafts: ToySetupDraft[] = [];
  const failures: string[] = [];
  const existingFingerprints = new Set<string>();
  if (storage.fingerprintImage) {
    const existingDrafts = await listToySetupDrafts(database);
    for (const draft of existingDrafts) {
      const fingerprint = await storage.fingerprintImage(draft.originalImageUri).catch(() => null);
      if (fingerprint) existingFingerprints.add(fingerprint);
    }
  }
  const uniqueSourceUris = [...new Set(sourceUris.filter(Boolean))];
  for (const [index, sourceUri] of uniqueSourceUris.entries()) {
    let managedUri: string | null = null;
    try {
      const id = intakeDraftIdForSource(sourceUri);
      if (await getToySetupDraft(database, id)) {
        failures.push('This photo is already in the review queue.');
        continue;
      }
      managedUri = await storage.copyIntoManagedStorage(sourceUri);
      const fingerprint = await storage.fingerprintImage?.(managedUri) ?? null;
      if (fingerprint && existingFingerprints.has(fingerprint)) {
        await storage.deleteManagedImage(managedUri).catch(() => undefined);
        failures.push('This photo is already in the review queue.');
        continue;
      }
      const contentId = fingerprint ? `intake-content-${fingerprint}` : id;
      drafts.push(await createToySetupDraft(database, {
        id: contentId,
        originalImageUri: managedUri,
        cleanupDifficultyDraft: 'easy',
        adultHelpRequiredDraft: false,
        isAvailableDraft: true,
      }));
      if (fingerprint) existingFingerprints.add(fingerprint);
    } catch (caught: unknown) {
      if (managedUri) await storage.deleteManagedImage(managedUri).catch(() => undefined);
      failures.push(caught instanceof Error ? caught.message : 'Could not prepare this photo.');
    }
    if ((index + 1) % 8 === 0) await yieldToUi();
  }
  return { drafts, failures };
}

export async function updateIntakeDraft(database: DatabaseConnection, draft: ToySetupDraft, patch: IntakeDraftPatch): Promise<ToySetupDraft> {
  const next = applyIntakeDraftPatch(draft, patch);
  const update: ToySetupDraftUpdate = {
    draftName: next.draftName,
    roomId: next.roomId,
    storageSpotId: next.storageSpotId,
    categoriesJson: next.categoriesJson,
    cleanupDifficultyDraft: next.cleanupDifficultyDraft,
    adultHelpRequiredDraft: next.adultHelpRequiredDraft,
    isAvailableDraft: next.isAvailableDraft,
    saveError: null,
  };
  return updateToySetupDraft(database, draft.id, update);
}

export async function replaceIntakeDraftImage(
  database: DatabaseConnection,
  draft: ToySetupDraft,
  sourceUri: string,
  storage: ToyImageStorage = expoToyImageStorage,
): Promise<ToySetupDraft> {
  if (draft.savedToyId !== null) throw new Error('A saved toy photo must be replaced from Edit Toy.');
  const managedUri = await storage.copyIntoManagedStorage(sourceUri);
  try {
    const updated = await updateToySetupDraft(database, draft.id, { originalImageUri: managedUri, saveError: null });
    await storage.deleteManagedImage(draft.originalImageUri).catch(() => undefined);
    return updated;
  } catch (error: unknown) {
    await storage.deleteManagedImage(managedUri).catch(() => undefined);
    throw error;
  }
}

export async function removeIntakeDraft(database: DatabaseConnection, draft: ToySetupDraft, storage: ToyImageStorage = expoToyImageStorage): Promise<void> {
  await discardToySetupDraft(database, draft.id, storage);
}

export async function saveIntakeQueue(database: DatabaseConnection, drafts: readonly ToySetupDraft[], storage: ToyImageStorage = expoToyImageStorage): Promise<ToySetupDraft[]> {
  const pending = drafts.filter((draft) => draft.savedToyId === null && intakeDraftErrors(draft).length === 0);
  const records: BulkToyRecord[] = pending.map((draft) => ({
    id: draft.id,
    input: {
      name: draft.draftName ?? '',
      sourceImageUri: null,
      existingImageUri: draft.originalImageUri,
      roomId: draft.roomId,
      storageSpotId: draft.storageSpotId,
      categories: draftCategories(draft),
      cleanupDifficulty: draft.cleanupDifficultyDraft ?? 'easy',
      adultHelpRequired: draft.adultHelpRequiredDraft ?? false,
      isAvailable: draft.isAvailableDraft,
    },
  }));
  const result = await createParentToysBulk(database, records, storage);
  const failed = new Map(result.failures.map((failure) => [failure.id, failure.message]));
  for (const draft of pending) {
    const message = failed.get(draft.id);
    if (message) {
      await updateToySetupDraft(database, draft.id, { saveError: message });
      continue;
    }
    const toy = await getParentToyByIntakeKey(database, draft.id);
    if (!toy) {
      await updateToySetupDraft(database, draft.id, { saveError: 'The saved toy could not be verified. Retry safely.' });
      continue;
    }
    await updateToySetupDraft(database, draft.id, { savedToyId: toy.id, saveError: null, parentReviewedAt: new Date().toISOString() });
  }
  return listToySetupDrafts(database);
}
