import type { PinStorage } from '@/services/pin-storage';
import {
  PARENT_GRACE_MS,
  PIN_ATTEMPT_LIMIT,
  PIN_COOLDOWN_MS,
  clearPinGate,
  describePinAttempt,
  initialPinGateState,
  isPinGateCoolingDown,
  isWithinParentGrace,
  registerFailedPinAttempt,
  secondsRemaining,
  verifyParentPin,
} from './parent-access';

const storage = (pin: string | null): PinStorage => ({ savePin: jest.fn(), getPin: jest.fn(async () => pin), deletePin: jest.fn() });

describe('parent access', () => {
  it('accepts the current PIN and rejects an incorrect PIN', async () => {
    await expect(verifyParentPin(storage('1234'), '1234')).resolves.toBe(true);
    await expect(verifyParentPin(storage('1234'), '0000')).resolves.toBe(false);
  });
  it('rejects missing PIN storage safely', async () => { await expect(verifyParentPin(storage(null), '1234')).resolves.toBe(false); });
});

describe('the PIN gate after a wrong entry', () => {
  const now = 1_760_000_000_000;

  it('says nothing before the first mistake', () => {
    expect(describePinAttempt(initialPinGateState, now)).toBeNull();
  });

  it('counts down the remaining tries and warns about the pause before it starts', () => {
    const first = registerFailedPinAttempt(initialPinGateState, now);
    expect(first).toEqual({ failedAttempts: 1, cooldownUntil: null });
    expect(describePinAttempt(first, now)).toBe('That PIN doesn’t match. 2 more tries, then Pip waits 30 seconds before asking again.');

    const second = registerFailedPinAttempt(first, now);
    expect(describePinAttempt(second, now)).toBe('That PIN doesn’t match. 1 more try, then Pip waits 30 seconds before asking again.');
  });

  it('starts a thirty-second pause on the third mistake and resets the counter', () => {
    let state = initialPinGateState;
    for (let attempt = 0; attempt < PIN_ATTEMPT_LIMIT; attempt += 1) state = registerFailedPinAttempt(state, now);
    expect(state).toEqual({ failedAttempts: 0, cooldownUntil: now + PIN_COOLDOWN_MS });
    expect(isPinGateCoolingDown(state, now)).toBe(true);
    expect(secondsRemaining(state, now)).toBe(30);
    expect(describePinAttempt(state, now)).toBe('Pip is waiting 30 more seconds before asking again.');
  });

  it('counts the pause down and ends it exactly on time', () => {
    let state = initialPinGateState;
    for (let attempt = 0; attempt < PIN_ATTEMPT_LIMIT; attempt += 1) state = registerFailedPinAttempt(state, now);
    expect(secondsRemaining(state, now + 29_000)).toBe(1);
    expect(describePinAttempt(state, now + 29_000)).toBe('Pip is waiting 1 more second before asking again.');
    expect(isPinGateCoolingDown(state, now + PIN_COOLDOWN_MS)).toBe(false);
    expect(describePinAttempt(state, now + PIN_COOLDOWN_MS)).toBeNull();
  });

  it('never locks permanently: a correct PIN clears the gate outright', () => {
    expect(clearPinGate()).toEqual(initialPinGateState);
  });
});

describe('remembering a parent between visits', () => {
  const now = 1_760_000_000_000;

  it('always asks again when the parent chose to be asked every time', () => {
    expect(isWithinParentGrace(now, now, true)).toBe(false);
  });

  it('asks again when no PIN has been entered yet this launch', () => {
    expect(isWithinParentGrace(null, now, false)).toBe(false);
  });

  it('remembers for five minutes and no longer', () => {
    expect(isWithinParentGrace(now, now + PARENT_GRACE_MS - 1, false)).toBe(true);
    expect(isWithinParentGrace(now, now + PARENT_GRACE_MS, false)).toBe(false);
  });
});
