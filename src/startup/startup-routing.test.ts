import type { AppSettings } from '@/domain/models';
import { getStartupDestination, type OnboardingState } from './startup-routing';

const settings: AppSettings = { onboardingCompleted: false, childNickname: null, activeChildId: null, choiceLimit: 3, cleanupRequired: true, createdAt: '', updatedAt: '' };
const state = (update: Partial<OnboardingState> = {}): OnboardingState => ({ settings, hasPin: false, hasChild: false, hasLocation: false, guestOnboardingStarted: false, ...update });

describe('canonical onboarding destination', () => {
  it('takes a verified parent directly to the PIN, never the guest introduction', () => { expect(getStartupDestination(state(), true)).toBe('/parent-pin-setup'); });
  it('resumes authenticated setup without restarting or skipping tasks', () => {
    expect(getStartupDestination(state({ hasPin: true }), true)).toBe('/child-profile-setup');
    expect(getStartupDestination(state({ hasPin: true, hasChild: true }), true)).toBe('/first-location-setup');
    expect(getStartupDestination(state({ settings: { ...settings, onboardingCompleted: true }, hasPin: true, hasChild: true, hasLocation: true }), true)).toBe('/parent/home');
  });
  it('keeps the account card to an unstarted local-only household and resumes guest setup', () => {
    expect(getStartupDestination(state(), false)).toBe('/onboarding');
    expect(getStartupDestination(state({ guestOnboardingStarted: true }), false)).toBe('/parent-pin-setup');
  });
});
