/**
 * Outbound email.
 *
 * Sending real mail needs a provider credential that this repository does not
 * carry. Everything else — code generation, expiry, resend limits, verification
 * and reset — is fully implemented against this interface, so the flows are
 * complete and testable locally. Configuring a provider is the only remaining
 * deployment step.
 */

export type VerificationEmail = {
  kind: 'verification';
  to: string;
  firstName: string;
  code: string;
};

export type PasswordResetEmail = {
  kind: 'password-reset';
  to: string;
  firstName: string;
  resetToken: string;
};

export type OutboundEmail = VerificationEmail | PasswordResetEmail;

export interface MailSender {
  send(email: OutboundEmail): Promise<void>;
}

/**
 * Development sender.
 *
 * Prints only that an email would have been sent and to which kind of flow.
 * The address, the code and the reset token are deliberately omitted: logs get
 * copied into issues and chat, and a logged code is a working credential.
 */
export class ConsoleMailSender implements MailSender {
  async send(email: OutboundEmail): Promise<void> {
    console.info(`[pip-auth] ${email.kind} email queued (no mail provider configured)`);
  }
}

/**
 * Captures messages instead of sending them, so tests can assert that a code
 * was issued without a provider.
 */
export class RecordingMailSender implements MailSender {
  readonly sent: OutboundEmail[] = [];

  async send(email: OutboundEmail): Promise<void> {
    this.sent.push(email);
  }
}

/** Fails every send, for exercising provider-outage handling. */
export class UnavailableMailSender implements MailSender {
  async send(): Promise<void> {
    throw new Error('mail provider unavailable');
  }
}
