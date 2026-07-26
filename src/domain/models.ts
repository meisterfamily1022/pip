import type { PlayCategory } from './play-category';

export type Timestamp = string;

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
  roomId: number;
  storageSpotId: number;
  isAvailable: boolean;
  isArchived: boolean;
  categories: PlayCategory[];
  createdAt: Timestamp;
  updatedAt: Timestamp;
};

export type PlaySessionStatus = 'active' | 'completed';

export type PlaySession = {
  id: number;
  toyId: number;
  status: PlaySessionStatus;
  startedAt: Timestamp;
  completedAt: Timestamp | null;
  createdAt: Timestamp;
  updatedAt: Timestamp;
};

export type ChoiceLimit = 1 | 3 | 5;

export type AppSettings = {
  onboardingCompleted: boolean;
  parentPin: string | null;
  childNickname: string | null;
  choiceLimit: ChoiceLimit;
  cleanupRequired: boolean;
  createdAt: Timestamp;
  updatedAt: Timestamp;
};
