import type { PlayCategory } from './play-category';

export type Timestamp = string;

export type PreferredImageVariant = 'original' | 'enhanced';
export type AiMetadataStatus = 'manual' | 'suggested' | 'confirmed';
export type ToySetupAnalysisStatus = 'not_requested' | 'queued' | 'processing' | 'ready' | 'failed';
export type ToySetupEnhancementStatus = 'not_requested' | 'queued' | 'processing' | 'ready' | 'failed';

export type Room = {
  id: number;
  name: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
};

export type StorageSpot = {
  id: number;
  roomId: number;
  name: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
};

export type Toy = {
  id: number;
  name: string;
  imageUri: string | null;
  originalImageUri: string | null;
  enhancedImageUri: string | null;
  preferredImageVariant: PreferredImageVariant;
  aiMetadataStatus: AiMetadataStatus;
  aiAnalysisId: string | null;
  aiSchemaVersion: string | null;
  aiConsentAt: Timestamp | null;
  aiConfirmedAt: Timestamp | null;
  roomId: number;
  storageSpotId: number;
  cleanupDifficulty: 'easy' | 'medium' | 'big';
  adultHelpRequired: boolean;
  isAvailable: boolean;
  isArchived: boolean;
  categories: PlayCategory[];
  createdAt: Timestamp;
  updatedAt: Timestamp;
};

export type ToySetupDraft = {
  id: string;
  originalImageUri: string;
  enhancedImageUri: string | null;
  draftName: string | null;
  roomId: number | null;
  storageSpotId: number | null;
  categoriesJson: string;
  cleanupDifficultyDraft: Toy['cleanupDifficulty'] | null;
  adultHelpRequiredDraft: boolean | null;
  isAvailableDraft: boolean;
  savedToyId: number | null;
  saveError: string | null;
  analysisStatus: ToySetupAnalysisStatus;
  enhancementStatus: ToySetupEnhancementStatus;
  aiConsentAt: Timestamp | null;
  parentReviewedAt: Timestamp | null;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  expiresAt: Timestamp | null;
};

export type PlaySessionStatus = 'active' | 'completed';

export type PlaySession = {
  id: number;
  childId: number;
  toyId: number;
  status: PlaySessionStatus;
  startedAt: Timestamp;
  completedAt: Timestamp | null;
  cleanupStartedAt: Timestamp | null;
  helpRequested: boolean;
  parentOverrideUsed: boolean;
  createdAt: Timestamp;
  updatedAt: Timestamp;
};

export type ChildProfile = {
  id: number;
  name: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
};

export type ChoiceLimit = 1 | 3 | 5;

export type AppSettings = {
  onboardingCompleted: boolean;
  childNickname: string | null;
  activeChildId: number | null;
  choiceLimit: ChoiceLimit;
  cleanupRequired: boolean;
  createdAt: Timestamp;
  updatedAt: Timestamp;
};
