import { childModeLockStorage, type ChildModeLockStorage } from '@/services/child-mode-lock-storage';
import { initializeApp } from './initialize-app';
import { getStartupDestination, type OnboardingDestination, type OnboardingState } from './startup-routing';

export type RouteAccessState = {
  initialized: boolean;
  onboardingComplete: boolean;
  onboardingState: OnboardingState | null;
  childModeLocked: boolean;
  postOnboardingDestination: '/parent/first-toy' | null;
  initializationError: string | null;
};

const listeners = new Set<() => void>();
let initialization: Promise<void> | null = null;
let state: RouteAccessState = {
  initialized: false,
  onboardingComplete: false,
  onboardingState: null,
  childModeLocked: false,
  postOnboardingDestination: null,
  initializationError: null,
};

function publish(update: Partial<RouteAccessState>): void {
  state = { ...state, ...update };
  listeners.forEach((listener) => listener());
}

export function subscribeRouteAccess(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getRouteAccessSnapshot(): RouteAccessState {
  return state;
}

export function initializeRouteAccess(
  start: (() => Promise<OnboardingState | '/onboarding' | '/parent/home'>) = initializeApp,
  lockStorage: ChildModeLockStorage = childModeLockStorage,
): Promise<void> {
  if (!initialization) {
    publish({ initialized: false, initializationError: null });
    initialization = Promise.all([start(), lockStorage.getLocked()])
      .then(async ([result, storedLock]) => {
        const onboardingState = typeof result === 'string' ? null : result;
        const onboardingComplete = onboardingState ? getStartupDestination(onboardingState, true) === '/parent/home' : result === '/parent/home';
        if (!onboardingComplete && storedLock) await lockStorage.setLocked(false);
        publish({
          initialized: true,
          onboardingComplete,
          onboardingState,
          childModeLocked: onboardingComplete && storedLock,
          postOnboardingDestination: null,
          initializationError: null,
        });
      })
      .catch((caught: unknown) => {
        initialization = null;
        publish({
          initialized: true,
          initializationError: caught instanceof Error ? caught.message : 'Pip could not start.',
        });
      });
  }
  return initialization;
}

export function markOnboardingComplete(): void {
  publish({ initialized: true, onboardingComplete: true, postOnboardingDestination: '/parent/first-toy', initializationError: null });
}

export function getOnboardingDestination(authenticated: boolean): OnboardingDestination {
  return state.onboardingState ? getStartupDestination(state.onboardingState, authenticated) : '/onboarding';
}

export async function enterChildMode(lockStorage: ChildModeLockStorage = childModeLockStorage): Promise<void> {
  await lockStorage.setLocked(true);
  publish({ childModeLocked: true });
}

export async function leaveChildMode(lockStorage: ChildModeLockStorage = childModeLockStorage): Promise<void> {
  await lockStorage.setLocked(false);
  publish({ childModeLocked: false });
}

export async function resetRouteAccess(lockStorage: ChildModeLockStorage = childModeLockStorage): Promise<void> {
  initialization = null;
  await lockStorage.setLocked(false);
  publish({ initialized: true, onboardingComplete: false, onboardingState: null, childModeLocked: false, postOnboardingDestination: null, initializationError: null });
}
