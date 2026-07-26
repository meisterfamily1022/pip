export type RoomRow = { id: number; name: string; created_at: string; updated_at: string };
export type StorageSpotRow = RoomRow & { room_id: number };
export type ToyRow = {
  id: number; name: string; image_uri: string | null; room_id: number; storage_spot_id: number;
  cleanup_difficulty: 'easy' | 'medium' | 'big'; adult_help_required: number;
  is_available: number; is_archived: number; created_at: string; updated_at: string;
};
export type PlaySessionRow = {
  id: number; toy_id: number; status: 'active' | 'completed'; started_at: string;
  completed_at: string | null; created_at: string; updated_at: string;
};
export type SettingsRow = {
  onboarding_completed: number; child_nickname: string | null;
  choice_limit: number; cleanup_required: number; created_at: string; updated_at: string;
};
