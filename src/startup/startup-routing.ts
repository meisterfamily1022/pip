import type { AppSettings } from '@/domain/models';

export type StartupDestination = '/onboarding' | '/parent/home';

export function getStartupDestination(settings: AppSettings, hasPin = true): StartupDestination {
  return settings.onboardingCompleted && hasPin ? '/parent/home' : '/onboarding';
}
