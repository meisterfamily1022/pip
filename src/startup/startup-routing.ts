import type { AppSettings } from '@/domain/models';

export type OnboardingDestination = '/onboarding' | '/parent-pin-setup' | '/child-profile-setup' | '/first-location-setup' | '/parent/home';
export type OnboardingState = { settings: AppSettings; hasPin: boolean; hasChild: boolean; hasLocation: boolean; guestOnboardingStarted: boolean };

/** The sole, durable source of truth for setup navigation. */
export function getStartupDestination(state: OnboardingState, authenticated: boolean): OnboardingDestination;
export function getStartupDestination(settings: AppSettings, hasPin?: boolean): '/onboarding' | '/parent/home';
export function getStartupDestination(state: OnboardingState | AppSettings, authenticatedOrHasPin = true): OnboardingDestination {
  if (!('settings' in state)) return state.onboardingCompleted && authenticatedOrHasPin ? '/parent/home' : '/onboarding';
  if (state.settings.onboardingCompleted && state.hasPin && state.hasChild && state.hasLocation) return '/parent/home';
  if (!state.hasPin) return authenticatedOrHasPin || state.guestOnboardingStarted ? '/parent-pin-setup' : '/onboarding';
  if (!state.hasChild) return '/child-profile-setup';
  return '/first-location-setup';
}
