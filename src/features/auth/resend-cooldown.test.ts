import {
  RESEND_COOLDOWN_SECONDS,
  readSupportContact,
  resendState,
  sentConfirmation,
} from './resend-cooldown';

const BASE = 1_800_000_000_000;

describe('resend cooldown', () => {
  it('offers a resend immediately when nothing has been sent yet', () => {
    const state = resendState({ lastSentAt: null, now: BASE, attempts: 0, sending: false });
    expect(state).toMatchObject({ canResend: true, secondsRemaining: 0, label: 'Send another code' });
  });

  it('counts down rather than letting the parent trigger the server rate limit', () => {
    const state = resendState({ lastSentAt: BASE, now: BASE + 15_000, attempts: 1, sending: false });
    expect(state.secondsRemaining).toBe(RESEND_COOLDOWN_SECONDS - 15);
    expect(state.canResend).toBe(false);
    expect(state.label).toBe('Send another code in 45s');
  });

  it('rounds up, so the button never enables a moment before the server allows it', () => {
    const state = resendState({ lastSentAt: BASE, now: BASE + 59_100, attempts: 1, sending: false });
    expect(state.secondsRemaining).toBe(1);
    expect(state.canResend).toBe(false);
  });

  it('re-enables exactly at the cooldown', () => {
    const state = resendState({ lastSentAt: BASE, now: BASE + RESEND_COOLDOWN_SECONDS * 1000, attempts: 1, sending: false });
    expect(state).toMatchObject({ secondsRemaining: 0, canResend: true });
  });

  it('never offers a resend while one is in flight', () => {
    const state = resendState({ lastSentAt: null, now: BASE, attempts: 0, sending: true });
    expect(state).toMatchObject({ canResend: false, label: 'Sending another code…' });
  });

  it('tolerates a clock that jumps backwards instead of showing a negative countdown', () => {
    const state = resendState({ lastSentAt: BASE, now: BASE - 5_000, attempts: 1, sending: false });
    expect(state.secondsRemaining).toBe(RESEND_COOLDOWN_SECONDS);
    expect(state.canResend).toBe(false);
  });
});

describe('guidance after repeated failures', () => {
  it('stays quiet while trying again is still reasonable', () => {
    for (const attempts of [0, 1, 2]) {
      expect(resendState({ lastSentAt: null, now: BASE, attempts, sending: false }).guidance).toBeNull();
    }
  });

  it('stops implying another press will work, and says what to check instead', () => {
    const { guidance } = resendState({ lastSentAt: null, now: BASE, attempts: 3, sending: false });
    expect(guidance).toContain('3 codes');
    expect(guidance).toMatch(/spam or junk/i);
    expect(guidance).toMatch(/different email address/i);
    // No promise that resending fixes it.
    expect(guidance).not.toMatch(/try again shortly|will arrive/i);
  });

  it('names a support channel only when one is actually configured', () => {
    const without = resendState({ lastSentAt: null, now: BASE, attempts: 3, sending: false }).guidance;
    expect(without).not.toMatch(/contact us/i);

    const with_ = resendState({
      lastSentAt: null, now: BASE, attempts: 3, sending: false, supportContact: 'help@example.com',
    }).guidance;
    expect(with_).toContain('help@example.com');
  });

  it('reads the support contact from configuration, treating blank as unset', () => {
    expect(readSupportContact(undefined)).toBeNull();
    expect(readSupportContact('   ')).toBeNull();
    expect(readSupportContact(' help@example.com ')).toBe('help@example.com');
  });
});

describe('send confirmation', () => {
  it('names the address, so an empty inbox is unambiguous', () => {
    expect(sentConfirmation('parent@example.com', 1)).toBe('A new code is on its way to parent@example.com.');
  });

  it('says the older codes are dead once more than one has been sent', () => {
    expect(sentConfirmation('parent@example.com', 2)).toMatch(/newest one — the earlier codes no longer work/);
  });
});
