import { createContext, useContext, useMemo, useState, type PropsWithChildren } from 'react';

import type { ChoiceLimit } from '@/domain/models';
import { DEFAULT_ACCENT_COLOR_ID, DEFAULT_AVATAR_ID, DEFAULT_READING_SUPPORT } from '@/domain/child-avatars';
import { DEFAULT_CHOICE_LIMIT, DEFAULT_CLEANUP_REQUIRED } from './validation';

export type OnboardingDraft = {
  pin: string;
  pinConfirmation: string;
  childNickname: string;
  childAvatarId: string;
  childAccentColorId: string;
  childReadingSupport: string;
  choiceLimit: ChoiceLimit;
  cleanupRequired: boolean;
  roomName: string;
  storageSpotName: string;
};

type OnboardingContextValue = {
  draft: OnboardingDraft;
  updateDraft(update: Partial<OnboardingDraft>): void;
};

const defaultDraft: OnboardingDraft = {
  pin: '',
  pinConfirmation: '',
  childNickname: '',
  childAvatarId: DEFAULT_AVATAR_ID,
  childAccentColorId: DEFAULT_ACCENT_COLOR_ID,
  childReadingSupport: DEFAULT_READING_SUPPORT,
  choiceLimit: DEFAULT_CHOICE_LIMIT,
  cleanupRequired: DEFAULT_CLEANUP_REQUIRED,
  roomName: '',
  storageSpotName: '',
};

const OnboardingContext = createContext<OnboardingContextValue | null>(null);

export function OnboardingProvider({ children }: PropsWithChildren) {
  const [draft, setDraft] = useState<OnboardingDraft>(defaultDraft);
  const value = useMemo<OnboardingContextValue>(() => ({
    draft,
    updateDraft(update) { setDraft((current) => ({ ...current, ...update })); },
  }), [draft]);
  return <OnboardingContext.Provider value={value}>{children}</OnboardingContext.Provider>;
}

export function useOnboarding(): OnboardingContextValue {
  const value = useContext(OnboardingContext);
  if (!value) throw new Error('OnboardingProvider is required.');
  return value;
}
