import type { ChildModeLockStorage } from '@/services/child-mode-lock-storage';
import {
  enterChildMode,
  getRouteAccessSnapshot,
  initializeRouteAccess,
  leaveChildMode,
  resetRouteAccess,
} from './route-access';

function lockStorage(initial = false): ChildModeLockStorage & { locked: boolean } {
  return {
    locked: initial,
    async getLocked() { return this.locked; },
    async setLocked(locked) { this.locked = locked; },
  };
}

describe('route access', () => {
  beforeEach(async () => {
    await resetRouteAccess(lockStorage());
  });

  it('discovers TSX tests and restores a persisted Child Mode lock', async () => {
    const storage = lockStorage(true);
    await initializeRouteAccess(async () => '/parent/home', storage);
    expect(getRouteAccessSnapshot()).toMatchObject({
      initialized: true,
      onboardingComplete: true,
      childModeLocked: true,
      initializationError: null,
    });
  });

  it('shows a startup failure and supports a clean retry', async () => {
    const storage = lockStorage();
    await initializeRouteAccess(async () => { throw new Error('Database unavailable.'); }, storage);
    expect(getRouteAccessSnapshot()).toMatchObject({ initialized: true, initializationError: 'Database unavailable.' });

    await initializeRouteAccess(async () => '/parent/home', storage);
    expect(getRouteAccessSnapshot()).toMatchObject({
      initialized: true,
      onboardingComplete: true,
      initializationError: null,
    });
  });

  it('clears a stale lock when onboarding is incomplete', async () => {
    const storage = lockStorage(true);
    await initializeRouteAccess(async () => '/onboarding', storage);
    expect(storage.locked).toBe(false);
    expect(getRouteAccessSnapshot()).toMatchObject({ onboardingComplete: false, childModeLocked: false });
  });

  it('persists entering and leaving Child Mode before changing access state', async () => {
    const storage = lockStorage();
    await enterChildMode(storage);
    expect(storage.locked).toBe(true);
    expect(getRouteAccessSnapshot().childModeLocked).toBe(true);

    await leaveChildMode(storage);
    expect(storage.locked).toBe(false);
    expect(getRouteAccessSnapshot().childModeLocked).toBe(false);
  });
});
