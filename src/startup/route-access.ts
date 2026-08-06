import { childModeLockStorage, type ChildModeLockStorage } from '@/services/child-mode-lock-storage';
import { initializeApp } from './initialize-app';

export type RouteAccessState = {
  initialized: boolean;
  onboardingComplete: boolean;
  childModeLocked: boolean;
  initializationError: string | null;
};

const listeners = new Set<() => void>();
let initialization: Promise<void> | null = null;
let state: RouteAccessState = {
  initialized: false,
  onboardingComplete: false,
  childModeLocked: false,
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
  start: typeof initializeApp = initializeApp,
  lockStorage: ChildModeLockStorage = childModeLockStorage,
): Promise<void> {
  if (!initialization) {
    publish({ initialized: false, initializationError: null });
    initialization = Promise.all([start(), lockStorage.getLocked()])
      .then(async ([destination, storedLock]) => {
        const onboardingComplete = destination === '/parent/home';
        if (!onboardingComplete && storedLock) await lockStorage.setLocked(false);
        publish({
          initialized: true,
          onboardingComplete,
          childModeLocked: onboardingComplete && storedLock,
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
  publish({ initialized: true, onboardingComplete: true, initializationError: null });
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
  publish({ initialized: true, onboardingComplete: false, childModeLocked: false, initializationError: null });
}
