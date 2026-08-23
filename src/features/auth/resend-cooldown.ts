/**
 * What the confirm-code screen may say and offer about resending.
 *
 * Two things drove this. The server enforces one email per address per
 * `smtp_max_frequency` seconds and answers a faster request with
 * `over_email_send_rate_limit`; a button that is always enabled turns that into
 * an error the parent caused by following the only affordance on screen. And
 * during staging QA one message in seven was accepted by SMTP and never
 * arrived, so "press it again" is not always the answer — after a couple of
 * tries the honest thing is to stop implying the next press will work.
 *
 * Kept pure and separate from the screen so the wording and the thresholds can
 * be tested without rendering anything or waiting on a real clock.
 */

/** Matches `smtp_max_frequency` on the Supabase project. */
export const RESEND_COOLDOWN_SECONDS = 60;

/** After this many sends with nothing arriving, stop suggesting another one. */
const ATTEMPTS_BEFORE_ESCALATING = 3;

export type ResendState = {
  /** Whole seconds until another send is allowed. Zero means now. */
  secondsRemaining: number;
  canResend: boolean;
  label: string;
  /** Extra guidance, or null while there is nothing useful to add. */
  guidance: string | null;
};

export type ResendInputs = {
  /** When the last code was sent, in epoch ms. Null if none has been sent. */
  lastSentAt: number | null;
  now: number;
  /** How many codes have been sent for this address in this attempt. */
  attempts: number;
  sending: boolean;
  /**
   * Where a parent can actually get help, when one is configured. Absent by
   * default: naming a channel that does not answer is worse than naming none.
   */
  supportContact?: string | null;
};

export function resendState({ lastSentAt, now, attempts, sending, supportContact }: ResendInputs): ResendState {
  const elapsed = lastSentAt === null ? Number.POSITIVE_INFINITY : Math.max(0, now - lastSentAt) / 1000;
  const secondsRemaining = Math.max(0, Math.ceil(RESEND_COOLDOWN_SECONDS - elapsed));
  const canResend = !sending && secondsRemaining === 0;

  const label = sending
    ? 'Sending another code…'
    : secondsRemaining > 0
      ? `Send another code in ${secondsRemaining}s`
      : 'Send another code';

  return { secondsRemaining, canResend, label, guidance: guidanceFor(attempts, supportContact) };
}

function guidanceFor(attempts: number, supportContact?: string | null): string | null {
  if (attempts < ATTEMPTS_BEFORE_ESCALATING) return null;
  // Deliberately does not promise that trying again will work, because by this
  // point the evidence is that it might not.
  const base =
    `Pip has sent ${attempts} codes to this address and none of them has worked. `
    + 'Check your spam or junk folder, and check the address above is spelled correctly. '
    + 'If it is, try a different email address.';
  return supportContact ? `${base} You can also contact us at ${supportContact}.` : base;
}

/** Confirmation that a code really went out, so an empty inbox is unambiguous. */
export function sentConfirmation(email: string, attempts: number): string {
  const suffix = attempts > 1 ? ' Use the newest one — the earlier codes no longer work.' : '';
  return `A new code is on its way to ${email}.${suffix}`;
}

/** Configured by whoever operates the deployment; unset in this repository. */
export function readSupportContact(
  value: string | undefined = process.env.EXPO_PUBLIC_PIP_SUPPORT_CONTACT,
): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}
