export type RoomRow = { id: number; name: string; created_at: string; updated_at: string };
export type StorageSpotRow = RoomRow & { room_id: number };
export type ToyRow = {
  id: number; name: string; image_uri: string | null; original_image_uri: string | null; enhanced_image_uri: string | null;
  preferred_image_variant: 'original' | 'enhanced'; ai_metadata_status: 'manual' | 'suggested' | 'confirmed';
  ai_analysis_id: string | null; ai_schema_version: string | null; ai_consent_at: string | null; ai_confirmed_at: string | null;
  room_id: number; storage_spot_id: number;
  cleanup_difficulty: 'easy' | 'medium' | 'big'; adult_help_required: number;
  is_available: number; is_archived: number; created_at: string; updated_at: string;
};
export type ToySetupDraftRow = {
  id: string; original_image_uri: string; enhanced_image_uri: string | null; draft_name: string | null;
  room_id: number | null; storage_spot_id: number | null; categories_json: string;
  cleanup_difficulty_draft: 'easy' | 'medium' | 'big' | null; adult_help_required_draft: number | null;
  analysis_status: 'not_requested' | 'queued' | 'processing' | 'ready' | 'failed';
  enhancement_status: 'not_requested' | 'queued' | 'processing' | 'ready' | 'failed';
  ai_consent_at: string | null; parent_reviewed_at: string | null; created_at: string; updated_at: string; expires_at: string | null;
};
export type PlaySessionRow = {
  id: number; toy_id: number; status: 'active' | 'completed'; started_at: string;
  completed_at: string | null; cleanup_started_at: string | null; help_requested: number;
  parent_override_used: number; created_at: string; updated_at: string;
};
export type SettingsRow = {
  onboarding_completed: number; child_nickname: string | null;
  choice_limit: number; cleanup_required: number; created_at: string; updated_at: string;
};
