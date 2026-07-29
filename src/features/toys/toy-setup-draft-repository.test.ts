import type { DatabaseConnection, SqlParameters, SqlRunResult } from '@/database/types';
import { createToySetupDraft, getToySetupDraft, listToySetupDrafts, updateToySetupDraft } from './toy-setup-draft-repository';
import { discardToySetupDraft } from './toy-setup-draft-service';
import type { ToyImageStorage } from './toy-image-storage';

type DraftRow = Record<string, string | number | null>;

class DraftDatabase implements DatabaseConnection {
  public readonly drafts = new Map<string, DraftRow>();
  public readonly toys: DraftRow[] = [];

  async execAsync(): Promise<void> {}
  async withTransactionAsync(task: () => Promise<void>): Promise<void> { await task(); }
  async runAsync(source: string, ...params: SqlParameters): Promise<SqlRunResult> {
    if (source.startsWith('INSERT INTO toy_setup_drafts')) {
      this.drafts.set(String(params[0]), { id: params[0]!, original_image_uri: params[1]!, enhanced_image_uri: params[2]!, draft_name: params[3]!, room_id: params[4]!, storage_spot_id: params[5]!, categories_json: params[6]!, cleanup_difficulty_draft: params[7]!, adult_help_required_draft: params[8]!, analysis_status: params[9]!, enhancement_status: params[10]!, ai_consent_at: params[11]!, parent_reviewed_at: params[12]!, created_at: params[13]!, updated_at: params[14]!, expires_at: params[15]! });
      return { lastInsertRowId: 0, changes: 1 };
    }
    if (source.startsWith('UPDATE toy_setup_drafts')) {
      const row = this.drafts.get(String(params[14]));
      if (!row) return { lastInsertRowId: 0, changes: 0 };
      [row.original_image_uri, row.enhanced_image_uri, row.draft_name, row.room_id, row.storage_spot_id, row.categories_json, row.cleanup_difficulty_draft, row.adult_help_required_draft, row.analysis_status, row.enhancement_status, row.ai_consent_at, row.parent_reviewed_at, row.updated_at, row.expires_at] = params;
      return { lastInsertRowId: 0, changes: 1 };
    }
    if (source.startsWith('DELETE FROM toy_setup_drafts')) return { lastInsertRowId: 0, changes: this.drafts.delete(String(params[0])) ? 1 : 0 };
    throw new Error(`Unhandled SQL: ${source}`);
  }
  async getFirstAsync<T>(source: string, ...params: SqlParameters): Promise<T | null> { return (this.drafts.get(String(params[0])) ?? null) as T | null; }
  async getAllAsync<T>(source: string): Promise<T[]> {
    if (source.includes('FROM toy_setup_drafts')) return [...this.drafts.values()] as T[];
    if (source.includes('FROM toys')) return this.toys as T[];
    return [];
  }
}

class DraftImageStorage implements ToyImageStorage {
  public readonly deleted: string[] = [];
  async copyIntoManagedStorage(uri: string): Promise<string> { return uri; }
  async deleteManagedImage(uri: string | null): Promise<void> { if (uri) this.deleted.push(uri); }
}

describe('toy setup drafts', () => {
  it('creates, reloads, updates, and discards a draft with owned image cleanup', async () => {
    const database = new DraftDatabase();
    const draft = await createToySetupDraft(database, { id: 'draft-1', originalImageUri: 'file:///original.jpg' });
    expect(await getToySetupDraft(database, draft.id)).toMatchObject({ id: 'draft-1', originalImageUri: 'file:///original.jpg', analysisStatus: 'not_requested' });
    await updateToySetupDraft(database, draft.id, { draftName: 'Blocks', enhancedImageUri: 'file:///enhanced.png', analysisStatus: 'ready', parentReviewedAt: '2026-01-01T00:00:00.000Z' });
    expect(await listToySetupDrafts(database)).toEqual([expect.objectContaining({ draftName: 'Blocks', enhancedImageUri: 'file:///enhanced.png', analysisStatus: 'ready' })]);
    const storage = new DraftImageStorage();
    await discardToySetupDraft(database, draft.id, storage);
    expect(database.drafts.size).toBe(0);
    expect(storage.deleted).toEqual(['file:///original.jpg', 'file:///enhanced.png']);
  });

  it('does not delete a draft image already adopted by a saved toy', async () => {
    const database = new DraftDatabase();
    database.toys.push({ image_uri: 'file:///original.jpg', original_image_uri: 'file:///original.jpg', enhanced_image_uri: null });
    const draft = await createToySetupDraft(database, { id: 'draft-2', originalImageUri: 'file:///original.jpg', enhancedImageUri: 'file:///enhanced.png' });
    const storage = new DraftImageStorage();
    await discardToySetupDraft(database, draft.id, storage);
    expect(storage.deleted).toEqual(['file:///enhanced.png']);
  });
});
