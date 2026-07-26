import type { AppSettings } from '@/domain/models';

export type StartupDestination = '/onboarding' | '/parent/home';

export function getStartupDestination(settings: AppSettings): StartupDestination {
  return settings.onboardingCompleted ? '/parent/home' : '/onboarding';
}
