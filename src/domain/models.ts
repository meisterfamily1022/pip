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
  /**
   * The remote storage object this toy's photo was last uploaded to, so a
   * later replace or delete can remove exactly that object. `null` when the
   * toy has never been backed up, or the caller's query did not select it —
   * only `getParentToy` does, since this is a backup/deletion concern, not
   * something Child Mode or the library list needs.
   */
  imageRemotePath: string | null;
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
  cleanupStep: number;
  helpRequested: boolean;
  parentOverrideUsed: boolean;
  createdAt: Timestamp;
  updatedAt: Timestamp;
};

export type ChildProfile = {
  id: number;
  householdId: string;
  name: string;
  avatarId: string;
  accentColorId: string;
  /** Broad band such as "4-5". Never an exact birthday. */
  ageRange: string | null;
  choiceLimit: ChoiceLimit;
  readingSupport: string;
  displayOrder: number;
  /** Set while the parent has temporarily hidden this profile. */
  hiddenAt: Timestamp | null;
  createdAt: Timestamp;
  updatedAt: Timestamp;
};

/**
 * The container every room, storage spot, toy, profile and session belongs to.
 * Local-only until the parent connects it to an account.
 */
export type Household = {
  id: string;
  name: string;
  isLocalOnly: boolean;
  remoteId: string | null;
  /**
   * The account that backed this household up, or null for the device-local
   * one. Only the owner may read an owned household; null is readable by
   * whoever holds the device, which is what keeps account-free use working.
   */
  ownerAccountId: string | null;
  createdAt: Timestamp;
  updatedAt: Timestamp;
};

/** Who may currently be offered a toy in Child Mode. */
export type ToyAvailabilityScope = 'everyone' | 'selected' | 'parent_only' | 'temporarily_unavailable';

export type ChoiceLimit = 1 | 3 | 5;

export type AppSettings = {
  onboardingCompleted: boolean;
  childModeUsed: boolean;
  childNickname: string | null;
  activeChildId: number | null;
  choiceLimit: ChoiceLimit;
  cleanupRequired: boolean;
  createdAt: Timestamp;
  updatedAt: Timestamp;
};
