import {
  SessionTokenSigner,
  burnPasswordComparison,
  hashOneTimeSecret,
  hashPassword,
  isAcceptablePassword,
  newId,
  newResetToken,
  newVerificationCode,
  oneTimeSecretMatches,
  verifyPassword,
} from './credentials';
import { AuthApplicationError, type AuthErrorCode } from './errors';
import { RATE_LIMITS, loadAuthConfig, type AuthConfig } from './config';
import { ConsoleMailSender, type MailSender } from './mail';
import { LocalDevelopmentAuthStorage, type AuthStorage } from './storage';

/**
 * Parent account services.
 *
 * Everything the account surfaces need lives here so route handlers stay thin,
 * matching how `server/ai` is organised. Three rules hold throughout:
 *
 * - **Nothing is logged.** No credential, code, token, address, child name, or
 *   image URI ever reaches a log from this module.
 * - **No enumeration.** Sign-up, sign-in and password reset return the same
 *   shape whether or not an address is registered.
 * - **Authorisation is re-derived server-side.** A household id from the client
 *   is never trusted; membership is checked against the session's account.
 */

export interface SystemClock {
  now(): Date;
}

const systemClock: SystemClock = { now: () => new Date() };

export type AuthenticatedContext = {
  accountId: string;
  householdId: string;
  firstName: string;
  email: string;
  emailVerified: boolean;
  sessionId: string;
};

export type SignUpResult = {
  /** Always true. Never reveals whether the address was already registered. */
  verificationRequired: true;
};

export type SessionResult = {
  token: string;
  expiresAt: string;
  context: AuthenticatedContext;
};

export type AuthServiceOptions = {
  storage?: AuthStorage;
  mail?: MailSender;
  clock?: SystemClock;
  config?: AuthConfig;
  requestId?: string;
};

const normaliseEmail = (email: string): string => email.trim().toLowerCase();

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export class AuthService {
  private readonly storage: AuthStorage;
  private readonly mail: MailSender;
  private readonly clock: SystemClock;
  private readonly config: AuthConfig;
  private readonly signer: SessionTokenSigner;
  private readonly requestId: string;

  constructor(options: AuthServiceOptions = {}) {
    this.storage = options.storage ?? new LocalDevelopmentAuthStorage();
    this.mail = options.mail ?? new ConsoleMailSender();
    this.clock = options.clock ?? systemClock;
    this.config = options.config ?? loadAuthConfig();
    this.signer = new SessionTokenSigner(this.config.sessionSecret);
    this.requestId = options.requestId ?? 'local';
  }

  private fail(code: AuthErrorCode): AuthApplicationError {
    return new AuthApplicationError(code, this.requestId);
  }

  private nowIso(): string {
    return this.clock.now().toISOString();
  }

  /** Rolling window bucket, so a limit resets without a scheduled job. */
  private async enforceRateLimit(key: string, rule: { limit: number; windowMs: number }): Promise<void> {
    const bucket = Math.floor(this.clock.now().getTime() / rule.windowMs);
    const count = await this.storage.rateLimits.hit(`${key}:${bucket}`, String(bucket));
    if (count > rule.limit) throw this.fail('RATE_LIMITED');
  }

  /* --------------------------------------------------------------- sign up */

  /**
   * Creates an account, its household, and an unverified email challenge.
   *
   * An address that already exists produces the same result without creating
   * anything and without sending a second code, so sign-up cannot be used to
   * discover registered addresses.
   */
  async signUp(input: {
    email: string;
    firstName: string;
    password: string;
    householdName?: string;
    acceptedTerms: boolean;
  }): Promise<SignUpResult> {
    const email = normaliseEmail(input.email);
    const firstName = input.firstName.trim();

    if (!EMAIL_PATTERN.test(email) || !firstName) throw this.fail('INVALID_REQUEST');
    // Consent is never assumed; the client must send an explicit acceptance.
    if (!input.acceptedTerms) throw this.fail('INVALID_REQUEST');
    if (!isAcceptablePassword(input.password)) throw this.fail('WEAK_PASSWORD');

    await this.enforceRateLimit(`signup:${email}`, RATE_LIMITS.resend);

    const existing = await this.storage.accounts.findByEmail(email);
    if (existing) return { verificationRequired: true };

    const timestamp = this.nowIso();
    const accountId = newId('acct');
    await this.storage.accounts.create({
      accountId,
      email,
      emailKey: email,
      firstName,
      passwordHash: hashPassword(input.password),
      createdAt: timestamp,
      updatedAt: timestamp,
    });

    // Household creation is part of the same call, so a retry cannot leave an
    // account without one.
    await this.storage.households.create(
      {
        householdId: newId('hh'),
        name: input.householdName?.trim() || `${firstName}'s Pip`,
        createdAt: timestamp,
      },
      accountId,
      timestamp,
    );

    await this.issueVerification(accountId, email, firstName);
    return { verificationRequired: true };
  }

  private async issueVerification(accountId: string, email: string, firstName: string): Promise<void> {
    const code = newVerificationCode();
    await this.storage.verifications.put({
      accountId,
      codeHash: hashOneTimeSecret(code, this.config.oneTimeSecret),
      expiresAt: new Date(this.clock.now().getTime() + this.config.verificationLifetimeMs).toISOString(),
      attempts: 0,
    });
    try {
      await this.mail.send({ kind: 'verification', to: email, firstName, code });
    } catch {
      // The challenge is stored, so a resend can succeed later. Surface a
      // retryable error rather than leaving the parent with no explanation.
      throw this.fail('EMAIL_UNAVAILABLE');
    }
  }

  /** Re-sends a confirmation code. Silent for unknown addresses. */
  async resendVerification(rawEmail: string): Promise<void> {
    const email = normaliseEmail(rawEmail);
    await this.enforceRateLimit(`resend:${email}`, RATE_LIMITS.resend);
    const account = await this.storage.accounts.findByEmail(email);
    if (!account || account.emailVerifiedAt) return;
    await this.issueVerification(account.accountId, account.email, account.firstName);
  }

  /** Confirms an address and starts a session, so the parent is not asked to sign in again. */
  async verifyEmail(rawEmail: string, code: string): Promise<SessionResult> {
    const email = normaliseEmail(rawEmail);
    await this.enforceRateLimit(`verify:${email}`, RATE_LIMITS.verification);

    const account = await this.storage.accounts.findByEmail(email);
    if (!account) throw this.fail('VERIFICATION_INVALID');

    const challenge = await this.storage.verifications.get(account.accountId);
    if (!challenge || challenge.expiresAt <= this.nowIso()) throw this.fail('VERIFICATION_INVALID');
    if (challenge.attempts >= RATE_LIMITS.verification.limit) throw this.fail('RATE_LIMITED');

    if (!oneTimeSecretMatches(code, challenge.codeHash, this.config.oneTimeSecret)) {
      await this.storage.verifications.put({ ...challenge, attempts: challenge.attempts + 1 });
      throw this.fail('VERIFICATION_INVALID');
    }

    const timestamp = this.nowIso();
    await this.storage.accounts.update({ ...account, emailVerifiedAt: timestamp, updatedAt: timestamp });
    await this.storage.verifications.delete(account.accountId);
    return this.startSession(account.accountId);
  }

  /* --------------------------------------------------------------- sign in */

  async signIn(rawEmail: string, password: string): Promise<SessionResult> {
    const email = normaliseEmail(rawEmail);
    await this.enforceRateLimit(`signin:${email}`, RATE_LIMITS.signIn);

    const account = await this.storage.accounts.findByEmail(email);
    if (!account?.passwordHash) {
      // Spend comparable time so response timing does not distinguish an
      // unknown address from a wrong password.
      burnPasswordComparison(password);
      throw this.fail('INVALID_CREDENTIALS');
    }
    if (!verifyPassword(password, account.passwordHash)) throw this.fail('INVALID_CREDENTIALS');
    if (!account.emailVerifiedAt) throw this.fail('EMAIL_UNVERIFIED');

    await this.storage.rateLimits.reset(`signin:${email}`);
    return this.startSession(account.accountId);
  }

  private async startSession(accountId: string): Promise<SessionResult> {
    const timestamp = this.nowIso();
    const sessionId = newId('sess');
    const expiresAt = new Date(this.clock.now().getTime() + this.config.sessionLifetimeMs).toISOString();

    await this.storage.sessions.create({
      sessionId,
      accountId,
      createdAt: timestamp,
      expiresAt,
      reauthenticatedAt: timestamp,
    });

    return {
      token: this.signer.issue({ sessionId, accountId, issuedAt: timestamp }),
      expiresAt,
      context: await this.contextFor(sessionId, accountId),
    };
  }

  private async contextFor(sessionId: string, accountId: string): Promise<AuthenticatedContext> {
    const account = await this.storage.accounts.get(accountId);
    if (!account) throw this.fail('SESSION_INVALID');
    const [household] = await this.storage.households.listForAccount(accountId);
    if (!household) throw this.fail('INTERNAL_ERROR');
    return {
      accountId,
      householdId: household.householdId,
      firstName: account.firstName,
      email: account.email,
      emailVerified: Boolean(account.emailVerifiedAt),
      sessionId,
    };
  }

  /**
   * Resolves a token to its session.
   *
   * The session is loaded every time rather than trusted from the token, so a
   * revoked session stops working immediately.
   */
  async authenticate(token: string): Promise<AuthenticatedContext> {
    const payload = this.signer.verify(token);
    if (!payload) throw this.fail('SESSION_INVALID');

    const session = await this.storage.sessions.get(payload.sessionId);
    if (!session || session.accountId !== payload.accountId) throw this.fail('SESSION_INVALID');
    if (session.revokedAt) throw this.fail('SESSION_INVALID');
    if (session.expiresAt <= this.nowIso()) throw this.fail('SESSION_EXPIRED');

    return this.contextFor(session.sessionId, session.accountId);
  }

  async signOut(token: string): Promise<void> {
    const payload = this.signer.verify(token);
    if (!payload) return;
    const session = await this.storage.sessions.get(payload.sessionId);
    // Signing out never touches local data; it only ends the server session.
    if (session && !session.revokedAt) {
      await this.storage.sessions.update({ ...session, revokedAt: this.nowIso() });
    }
  }

  /* ------------------------------------------------------------- recovery */

  /**
   * Starts a password reset.
   *
   * Returns nothing and never signals whether the address exists, so the
   * caller's copy can only ever say "if that address has an account".
   */
  async requestPasswordReset(rawEmail: string): Promise<void> {
    const email = normaliseEmail(rawEmail);
    await this.enforceRateLimit(`reset:${email}`, RATE_LIMITS.passwordReset);

    const account = await this.storage.accounts.findByEmail(email);
    if (!account) return;

    const resetToken = newResetToken();
    await this.storage.resets.put({
      tokenHash: hashOneTimeSecret(resetToken, this.config.oneTimeSecret),
      accountId: account.accountId,
      expiresAt: new Date(this.clock.now().getTime() + this.config.resetLifetimeMs).toISOString(),
    });
    try {
      await this.mail.send({ kind: 'password-reset', to: account.email, firstName: account.firstName, resetToken });
    } catch {
      throw this.fail('EMAIL_UNAVAILABLE');
    }
  }

  /**
   * Completes a reset and revokes every existing session.
   *
   * If the reset was triggered because someone else had access, leaving their
   * sessions alive would defeat the point.
   */
  async resetPassword(resetToken: string, newPassword: string): Promise<void> {
    if (!isAcceptablePassword(newPassword)) throw this.fail('WEAK_PASSWORD');

    const tokenHash = hashOneTimeSecret(resetToken, this.config.oneTimeSecret);
    const record = await this.storage.resets.get(tokenHash);
    if (!record || record.usedAt || record.expiresAt <= this.nowIso()) throw this.fail('RESET_INVALID');

    const account = await this.storage.accounts.get(record.accountId);
    if (!account) throw this.fail('RESET_INVALID');

    const timestamp = this.nowIso();
    await this.storage.accounts.update({
      ...account,
      passwordHash: hashPassword(newPassword),
      // Completing a reset proves control of the address.
      emailVerifiedAt: account.emailVerifiedAt ?? timestamp,
      updatedAt: timestamp,
    });
    await this.storage.resets.update({ ...record, usedAt: timestamp });
    await this.storage.sessions.revokeAllForAccount(account.accountId, timestamp);
  }

  /* ------------------------------------------------- sensitive operations */

  /** Confirms the current password and refreshes the re-authentication stamp. */
  async reauthenticate(token: string, password: string): Promise<void> {
    const context = await this.authenticate(token);
    const account = await this.storage.accounts.get(context.accountId);
    if (!account?.passwordHash || !verifyPassword(password, account.passwordHash)) {
      throw this.fail('INVALID_CREDENTIALS');
    }
    const session = await this.storage.sessions.get(context.sessionId);
    if (!session) throw this.fail('SESSION_INVALID');
    await this.storage.sessions.update({ ...session, reauthenticatedAt: this.nowIso() });
  }

  /** Throws unless the session confirmed its password recently. */
  async requireRecentAuthentication(token: string): Promise<AuthenticatedContext> {
    const context = await this.authenticate(token);
    const session = await this.storage.sessions.get(context.sessionId);
    if (!session) throw this.fail('SESSION_INVALID');
    const age = this.clock.now().getTime() - new Date(session.reauthenticatedAt).getTime();
    if (age > this.config.reauthenticationWindowMs) throw this.fail('REAUTHENTICATION_REQUIRED');
    return context;
  }

  /**
   * Changes the address and returns the account to unverified.
   *
   * The new address has not been proven yet, so verification restarts.
   */
  async changeEmail(token: string, rawEmail: string): Promise<void> {
    const context = await this.requireRecentAuthentication(token);
    const email = normaliseEmail(rawEmail);
    if (!EMAIL_PATTERN.test(email)) throw this.fail('INVALID_REQUEST');

    const account = await this.storage.accounts.get(context.accountId);
    if (!account) throw this.fail('SESSION_INVALID');
    if (email === account.emailKey) return;

    const taken = await this.storage.accounts.findByEmail(email);
    // Reported as success so the response cannot be used to test addresses.
    if (taken) return;

    const timestamp = this.nowIso();
    await this.storage.accounts.update({
      ...account,
      email,
      emailKey: email,
      emailVerifiedAt: undefined,
      updatedAt: timestamp,
    });
    await this.issueVerification(account.accountId, email, account.firstName);
  }

  /* -------------------------------------------------------- authorisation */

  /**
   * Confirms the session's account belongs to `householdId`.
   *
   * Every protected read and write goes through this. The household id is
   * treated as untrusted input regardless of where the client got it.
   */
  async authorizeHousehold(token: string, householdId: string): Promise<AuthenticatedContext> {
    const context = await this.authenticate(token);
    const membership = await this.storage.households.membership(householdId, context.accountId);
    if (!membership) throw this.fail('FORBIDDEN');
    return { ...context, householdId };
  }

  /**
   * Names the household.
   *
   * Renaming is idempotent, so a retry after a dropped connection settles on
   * the same value rather than creating anything.
   */
  async renameHousehold(token: string, householdId: string, name: string): Promise<{ householdId: string; name: string }> {
    const context = await this.authorizeHousehold(token, householdId);
    const trimmed = name.trim();
    if (!trimmed || trimmed.length > 60) throw this.fail('INVALID_REQUEST');
    await this.storage.households.rename(context.householdId, trimmed);
    return { householdId: context.householdId, name: trimmed };
  }

  /** Which third-party sign-in buttons the client should show. */
  availableProviders(): { apple: boolean; google: boolean } {
    return { apple: this.config.appleSignInEnabled, google: this.config.googleSignInEnabled };
  }
}
