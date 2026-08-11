import type { PinStorage } from '@/services/pin-storage';

export async function verifyParentPin(storage: PinStorage, enteredPin: string): Promise<boolean> {
  const storedPin = await storage.getPin();
  return storedPin !== null && storedPin === enteredPin;
}

/**
 * How the PIN gate behaves after a wrong entry.
 *
 * Three tries, then a thirty-second pause. The pause exists so a child tapping
 * at random does not eventually land on the right four digits, not to punish a
 * parent who mistyped — which is why the wait is short, why it is announced
 * before it happens, and why nothing is ever locked permanently.
 */
export const PIN_ATTEMPT_LIMIT = 3;
export const PIN_COOLDOWN_MS = 30_000;

export type PinGateState = {
  /** Failed attempts since the last success or cool-down. */
  failedAttempts: number;
  /** When the current pause ends, in epoch milliseconds. */
  cooldownUntil: number | null;
};

export const initialPinGateState: PinGateState = { failedAttempts: 0, cooldownUntil: null };

export function registerFailedPinAttempt(state: PinGateState, now: number): PinGateState {
  const failedAttempts = state.failedAttempts + 1;
  if (failedAttempts >= PIN_ATTEMPT_LIMIT) {
    return { failedAttempts: 0, cooldownUntil: now + PIN_COOLDOWN_MS };
  }
  return { failedAttempts, cooldownUntil: null };
}

export function clearPinGate(): PinGateState {
  return { ...initialPinGateState };
}

export function isPinGateCoolingDown(state: PinGateState, now: number): boolean {
  return state.cooldownUntil !== null && state.cooldownUntil > now;
}

export function secondsRemaining(state: PinGateState, now: number): number {
  if (!isPinGateCoolingDown(state, now)) return 0;
  return Math.ceil(((state.cooldownUntil ?? 0) - now) / 1000);
}

/**
 * What to say after a wrong entry. The count is stated up front so the pause is
 * never a surprise, and the wording never implies the child did something wrong.
 */
export function describePinAttempt(state: PinGateState, now: number): string | null {
  if (isPinGateCoolingDown(state, now)) {
    const seconds = secondsRemaining(state, now);
    return `Pip is waiting ${seconds} more ${seconds === 1 ? 'second' : 'seconds'} before asking again.`;
  }
  if (state.failedAttempts === 0) return null;
  const left = PIN_ATTEMPT_LIMIT - state.failedAttempts;
  return `That PIN doesn’t match. ${left} more ${left === 1 ? 'try' : 'tries'}, then Pip waits 30 seconds before asking again.`;
}

/** How long Pip remembers a parent after a correct PIN, when asked not to re-ask. */
export const PARENT_GRACE_MS = 5 * 60_000;

export function isWithinParentGrace(lastVerifiedAt: number | null, now: number, askEveryTime: boolean): boolean {
  if (askEveryTime || lastVerifiedAt === null) return false;
  return now - lastVerifiedAt < PARENT_GRACE_MS;
}
