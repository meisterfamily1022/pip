import type { DatabaseConnection } from '@/database/types';
import type { ToySetupDraft } from '@/domain/models';
import type { ToySetupDraftRow } from '@/database/rows';

const now = (): string => new Date().toISOString();

function mapDraft(row: ToySetupDraftRow): ToySetupDraft {
  return {
    id: row.id,
    originalImageUri: row.original_image_uri,
    enhancedImageUri: row.enhanced_image_uri,
    draftName: row.draft_name,
    roomId: row.room_id,
    storageSpotId: row.storage_spot_id,
    categoriesJson: row.categories_json,
    cleanupDifficultyDraft: row.cleanup_difficulty_draft,
    adultHelpRequiredDraft: row.adult_help_required_draft === null ? null : row.adult_help_required_draft === 1,
    analysisStatus: row.analysis_status,
    enhancementStatus: row.enhancement_status,
    aiConsentAt: row.ai_consent_at,
    parentReviewedAt: row.parent_reviewed_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    expiresAt: row.expires_at,
  };
}

const select = 'SELECT id, original_image_uri, enhanced_image_uri, draft_name, room_id, storage_spot_id, categories_json, cleanup_difficulty_draft, adult_help_required_draft, analysis_status, enhancement_status, ai_consent_at, parent_reviewed_at, created_at, updated_at, expires_at FROM toy_setup_drafts';

export type ToySetupDraftInput = Pick<ToySetupDraft, 'originalImageUri'> & { id?: string } & Partial<Omit<ToySetupDraft, 'id' | 'originalImageUri' | 'createdAt' | 'updatedAt'>>;

export async function createToySetupDraft(database: DatabaseConnection, input: ToySetupDraftInput): Promise<ToySetupDraft> {
  const timestamp = now();
  const id = input.id ?? `draft-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  await database.runAsync(
    'INSERT INTO toy_setup_drafts (id, original_image_uri, enhanced_image_uri, draft_name, room_id, storage_spot_id, categories_json, cleanup_difficulty_draft, adult_help_required_draft, analysis_status, enhancement_status, ai_consent_at, parent_reviewed_at, created_at, updated_at, expires_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);',
    id, input.originalImageUri, input.enhancedImageUri ?? null, input.draftName ?? null, input.roomId ?? null, input.storageSpotId ?? null, input.categoriesJson ?? '[]', input.cleanupDifficultyDraft ?? null, input.adultHelpRequiredDraft === null || input.adultHelpRequiredDraft === undefined ? null : input.adultHelpRequiredDraft ? 1 : 0, input.analysisStatus ?? 'not_requested', input.enhancementStatus ?? 'not_requested', input.aiConsentAt ?? null, input.parentReviewedAt ?? null, timestamp, timestamp, input.expiresAt ?? null,
  );
  const draft = await getToySetupDraft(database, id);
  if (!draft) throw new Error('Created toy setup draft could not be loaded.');
  return draft;
}

export async function getToySetupDraft(database: DatabaseConnection, id: string): Promise<ToySetupDraft | null> {
  const row = await database.getFirstAsync<ToySetupDraftRow>(`${select} WHERE id = ?;`, id);
  return row ? mapDraft(row) : null;
}

export async function listToySetupDrafts(database: DatabaseConnection): Promise<ToySetupDraft[]> {
  const rows = await database.getAllAsync<ToySetupDraftRow>(`${select} ORDER BY updated_at DESC;`);
  return rows.map(mapDraft);
}

export type ToySetupDraftUpdate = Partial<Omit<ToySetupDraft, 'id' | 'createdAt'>>;

export async function updateToySetupDraft(database: DatabaseConnection, id: string, update: ToySetupDraftUpdate): Promise<ToySetupDraft> {
  const existing = await getToySetupDraft(database, id);
  if (!existing) throw new Error('Toy setup draft not found.');
  const next = { ...existing, ...update, updatedAt: now() };
  await database.runAsync(
    'UPDATE toy_setup_drafts SET original_image_uri = ?, enhanced_image_uri = ?, draft_name = ?, room_id = ?, storage_spot_id = ?, categories_json = ?, cleanup_difficulty_draft = ?, adult_help_required_draft = ?, analysis_status = ?, enhancement_status = ?, ai_consent_at = ?, parent_reviewed_at = ?, updated_at = ?, expires_at = ? WHERE id = ?;',
    next.originalImageUri, next.enhancedImageUri, next.draftName, next.roomId, next.storageSpotId, next.categoriesJson, next.cleanupDifficultyDraft, next.adultHelpRequiredDraft === null ? null : next.adultHelpRequiredDraft ? 1 : 0, next.analysisStatus, next.enhancementStatus, next.aiConsentAt, next.parentReviewedAt, next.updatedAt, next.expiresAt, id,
  );
  const draft = await getToySetupDraft(database, id);
  if (!draft) throw new Error('Updated toy setup draft could not be loaded.');
  return draft;
}

export async function deleteToySetupDraft(database: DatabaseConnection, id: string): Promise<void> {
  const result = await database.runAsync('DELETE FROM toy_setup_drafts WHERE id = ?;', id);
  if (result.changes !== 1) throw new Error('Toy setup draft not found.');
}
