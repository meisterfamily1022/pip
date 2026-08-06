import type { ToySetupDraft } from '@/domain/models';
import type { DatabaseConnection, SqlParameters, SqlRunResult } from '@/database/types';
import type { ToyImageStorage } from './toy-image-storage';

import { addImagesToIntakeQueue, draftCategories, intakeDraftErrors, intakeDraftIdForSource, summarizeIntakeQueue } from './toy-intake-queue';

const draft = (overrides: Partial<ToySetupDraft> = {}): ToySetupDraft => ({
  id: 'draft-1',
  originalImageUri: 'file:///photo.jpg',
  enhancedImageUri: null,
  draftName: null,
  roomId: null,
  storageSpotId: null,
  categoriesJson: '[]',
  cleanupDifficultyDraft: 'easy',
  adultHelpRequiredDraft: false,
  isAvailableDraft: true,
  savedToyId: null,
  saveError: null,
  analysisStatus: 'not_requested',
  enhancementStatus: 'not_requested',
  aiConsentAt: null,
  parentReviewedAt: null,
  createdAt: '',
  updatedAt: '',
  expiresAt: null,
  ...overrides,
});

describe('toy intake review queue', () => {
  it('keeps uncertain fields visibly incomplete', () => {
    expect(intakeDraftErrors(draft())).toEqual(['Enter a toy name.', 'Choose a room.', 'Choose a storage spot.', 'Choose at least one category.']);
  });

  it('recognizes a complete record and parses confirmed categories', () => {
    const complete = draft({ draftName: 'Blocks', roomId: 1, storageSpotId: 2, categoriesJson: '["building"]' });
    expect(intakeDraftErrors(complete)).toEqual([]);
    expect(draftCategories(complete)).toEqual(['building']);
  });

  it('counts selected, completed, incomplete, and failed records', () => {
    const drafts = [
      draft(),
      draft({ id: 'ready', draftName: 'Blocks', roomId: 1, storageSpotId: 2, categoriesJson: '["building"]' }),
      draft({ id: 'failed', saveError: 'Disk full' }),
      draft({ id: 'saved', savedToyId: 42 }),
    ];
    expect(summarizeIntakeQueue(drafts)).toEqual({ total: 4, completed: 1, incomplete: 1, failed: 1 });
  });

  it('survives serialization used by persisted draft storage', () => {
    const restored = JSON.parse(JSON.stringify(draft({ draftName: 'Train', roomId: 1 }))) as ToySetupDraft;
    expect(restored).toMatchObject({ id: 'draft-1', draftName: 'Train', roomId: 1, originalImageUri: 'file:///photo.jpg' });
  });

  it('derives stable per-source intake keys for duplicate protection', () => {
    expect(intakeDraftIdForSource('file:///same.jpg')).toBe(intakeDraftIdForSource('file:///same.jpg'));
    expect(intakeDraftIdForSource('file:///same.jpg')).not.toBe(intakeDraftIdForSource('file:///other.jpg'));
  });

  it('rejects duplicate managed image content even when picker URIs differ', async () => {
    const rows = new Map<string, Record<string, string | number | null>>();
    const database: DatabaseConnection = {
      async execAsync() {},
      async withTransactionAsync(task) { await task(); },
      async runAsync(_source: string, ...parameters: SqlParameters): Promise<SqlRunResult> {
        const [id, originalImageUri, enhancedImageUri, draftName, roomId, storageSpotId, categoriesJson, cleanupDifficulty, adultHelp, available, savedToyId, saveError, analysisStatus, enhancementStatus, aiConsentAt, parentReviewedAt, createdAt, updatedAt, expiresAt] = parameters;
        rows.set(String(id), { id: id!, original_image_uri: originalImageUri!, enhanced_image_uri: enhancedImageUri!, draft_name: draftName!, room_id: roomId!, storage_spot_id: storageSpotId!, categories_json: categoriesJson!, cleanup_difficulty_draft: cleanupDifficulty!, adult_help_required_draft: adultHelp!, is_available_draft: available!, saved_toy_id: savedToyId!, save_error: saveError!, analysis_status: analysisStatus!, enhancement_status: enhancementStatus!, ai_consent_at: aiConsentAt!, parent_reviewed_at: parentReviewedAt!, created_at: createdAt!, updated_at: updatedAt!, expires_at: expiresAt! });
        return { lastInsertRowId: 0, changes: 1 };
      },
      async getFirstAsync<T>(_source: string, ...parameters: SqlParameters): Promise<T | null> { return (rows.get(String(parameters[0])) ?? null) as T | null; },
      async getAllAsync<T>(): Promise<T[]> { return [...rows.values()] as T[]; },
    };
    const deleted: string[] = [];
    const storage: ToyImageStorage = {
      async copyIntoManagedStorage() { return 'data:image/png;base64,same-content'; },
      async deleteManagedImage(uri) { if (uri) deleted.push(uri); },
      async fingerprintImage() { return 'same-fingerprint'; },
    };
    const result = await addImagesToIntakeQueue(database, ['blob:first', 'blob:second'], storage, async () => undefined);
    expect(result.drafts).toHaveLength(1);
    expect(result.failures).toEqual(['This photo is already in the review queue.']);
    expect(rows.size).toBe(1);
    expect(deleted).toEqual(['data:image/png;base64,same-content']);
  });
});
