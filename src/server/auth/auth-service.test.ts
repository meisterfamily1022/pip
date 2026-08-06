import { AuthService, type SystemClock } from './auth-service';
import { AUTH_DEFAULTS, loadAuthConfig, AuthConfigurationError } from './config';
import { hashPassword, isAcceptablePassword, verifyPassword, SessionTokenSigner } from './credentials';
import { AuthApplicationError, type AuthErrorCode } from './errors';
import { RecordingMailSender, UnavailableMailSender, type MailSender } from './mail';
import { LocalDevelopmentAuthStorage, resetAuthStorageForTests, type AuthStorage } from './storage';

const PASSWORD = 'correct-horse-battery';

class TestClock implements SystemClock {
  constructor(private current = new Date('2026-08-06T12:00:00.000Z')) {}
  now(): Date {
    return this.current;
  }
  advance(ms: number): void {
    this.current = new Date(this.current.getTime() + ms);
  }
}

/**
 * Generic over the mail sender so the default gives back a RecordingMailSender
 * that tests can inspect, while an override keeps its own type.
 */
function build<TMail extends MailSender = RecordingMailSender>(
  overrides: { clock?: TestClock; mail?: TMail; storage?: AuthStorage } = {},
) {
  const clock = overrides.clock ?? new TestClock();
  const mail = overrides.mail ?? (new RecordingMailSender() as unknown as TMail);
  const storage = overrides.storage ?? new LocalDevelopmentAuthStorage();
  const config = loadAuthConfig({ PIP_SESSION_SECRET: 'test-session', PIP_ONE_TIME_SECRET: 'test-one-time' });
  return { service: new AuthService({ clock, mail, storage, config }), clock, mail, storage, config };
}

async function codeFor(mail: RecordingMailSender): Promise<string> {
  const latest = [...mail.sent].reverse().find((email) => email.kind === 'verification');
  if (!latest || latest.kind !== 'verification') throw new Error('no verification email');
  return latest.code;
}

async function registerVerified(
  service: AuthService,
  mail: RecordingMailSender,
  email = 'parent@example.com',
): Promise<string> {
  await service.signUp({ email, firstName: 'Sam', password: PASSWORD, acceptedTerms: true });
  const session = await service.verifyEmail(email, await codeFor(mail));
  return session.token;
}

function expectAuthError(action: Promise<unknown>, code: AuthErrorCode): Promise<void> {
  return expect(action)
    .rejects.toBeInstanceOf(AuthApplicationError)
    .then(async () => {
      await expect(action).rejects.toMatchObject({ code });
    });
}

beforeEach(() => {
  resetAuthStorageForTests();
});

describe("password storage", () => {
  it("never stores the password and verifies the right one", () => {
    const stored = hashPassword(PASSWORD);
    expect(stored).not.toContain(PASSWORD);
    expect(stored.startsWith("scrypt$1$")).toBe(true);
    expect(verifyPassword(PASSWORD, stored)).toBe(true);
    expect(verifyPassword("wrong-password-entirely", stored)).toBe(false);
  });

  it("salts each hash, so identical passwords do not collide", () => {
    expect(hashPassword(PASSWORD)).not.toBe(hashPassword(PASSWORD));
  });

  it("rejects a malformed stored hash instead of throwing", () => {
    expect(verifyPassword(PASSWORD, "not-a-hash")).toBe(false);
    expect(verifyPassword(PASSWORD, "")).toBe(false);
  });

  it("enforces only the documented length rule", () => {
    expect(isAcceptablePassword("short")).toBe(false);
    expect(isAcceptablePassword("0123456789")).toBe(true);
  });
});

describe("session tokens", () => {
  const signer = new SessionTokenSigner("secret-one");

  it("round-trips a payload", () => {
    const token = signer.issue({ sessionId: "sess_1", accountId: "acct_1", issuedAt: "2026-08-06T12:00:00.000Z" });
    expect(signer.verify(token)).toMatchObject({ sessionId: "sess_1", accountId: "acct_1" });
  });

  it("rejects a token signed with a different secret", () => {
    const token = signer.issue({ sessionId: "sess_1", accountId: "acct_1", issuedAt: "2026-08-06T12:00:00.000Z" });
    expect(new SessionTokenSigner("secret-two").verify(token)).toBeUndefined();
  });

  it("rejects tampering, junk, and oversized input", () => {
    const token = signer.issue({ sessionId: "sess_1", accountId: "acct_1", issuedAt: "2026-08-06T12:00:00.000Z" });
    expect(signer.verify(`${token}x`)).toBeUndefined();
    expect(signer.verify("pip_nonsense")).toBeUndefined();
    expect(signer.verify("")).toBeUndefined();
    expect(signer.verify(`pip_${"a".repeat(2000)}`)).toBeUndefined();
  });

  it("refuses to sign with an empty secret", () => {
    expect(() => new SessionTokenSigner("")).toThrow();
  });
});

describe("sign up and verification", () => {
  it("creates an account with a household and requires confirmation", async () => {
    const { service, mail } = build();
    const result = await service.signUp({ email: "Parent@Example.com", firstName: "Sam", password: PASSWORD, acceptedTerms: true });

    expect(result).toEqual({ verificationRequired: true });
    expect(mail.sent).toHaveLength(1);

    const session = await service.verifyEmail("parent@example.com", await codeFor(mail));
    expect(session.context).toMatchObject({ firstName: "Sam", email: "parent@example.com", emailVerified: true });
    expect(session.context.householdId).toMatch(/^hh_/);
  });

  it("does not reveal that an address is already registered", async () => {
    const { service, mail } = build();
    await service.signUp({ email: "parent@example.com", firstName: "Sam", password: PASSWORD, acceptedTerms: true });
    const before = mail.sent.length;

    const second = await service.signUp({
      email: "parent@example.com",
      firstName: "Impostor",
      password: "another-long-password",
      acceptedTerms: true,
    });

    // Same response shape, and no second code sent to the real owner.
    expect(second).toEqual({ verificationRequired: true });
    expect(mail.sent).toHaveLength(before);
  });

  it("refuses to create an account without explicit consent", async () => {
    const { service } = build();
    await expectAuthError(
      service.signUp({ email: "parent@example.com", firstName: "Sam", password: PASSWORD, acceptedTerms: false }),
      "INVALID_REQUEST",
    );
  });

  it("rejects a weak password and a malformed address", async () => {
    const { service } = build();
    await expectAuthError(
      service.signUp({ email: "parent@example.com", firstName: "Sam", password: "short", acceptedTerms: true }),
      "WEAK_PASSWORD",
    );
    await expectAuthError(
      service.signUp({ email: "not-an-email", firstName: "Sam", password: PASSWORD, acceptedTerms: true }),
      "INVALID_REQUEST",
    );
  });

  it("rejects an expired or incorrect code", async () => {
    const { service, mail, clock } = build();
    await service.signUp({ email: "parent@example.com", firstName: "Sam", password: PASSWORD, acceptedTerms: true });

    await expectAuthError(service.verifyEmail("parent@example.com", "000000"), "VERIFICATION_INVALID");

    clock.advance(AUTH_DEFAULTS.verificationLifetimeMs + 1000);
    await expectAuthError(service.verifyEmail("parent@example.com", await codeFor(mail)), "VERIFICATION_INVALID");
  });

  it("reports a mail outage as retryable rather than losing the account", async () => {
    const { service, storage } = build({ mail: new UnavailableMailSender() });
    await expectAuthError(
      service.signUp({ email: "parent@example.com", firstName: "Sam", password: PASSWORD, acceptedTerms: true }),
      "EMAIL_UNAVAILABLE",
    );
    // The account still exists, so a resend can recover it.
    expect(await storage.accounts.findByEmail("parent@example.com")).toBeDefined();
  });

  it("stays silent when asked to resend to an unknown address", async () => {
    const { service, mail } = build();
    await expect(service.resendVerification("nobody@example.com")).resolves.toBeUndefined();
    expect(mail.sent).toHaveLength(0);
  });
});

describe("sign in", () => {
  it("issues a session for the right password", async () => {
    const { service, mail } = build();
    await registerVerified(service, mail);
    const session = await service.signIn("parent@example.com", PASSWORD);
    expect(session.token).toMatch(/^pip_/);
  });

  it("returns the same error for a wrong password and an unknown address", async () => {
    const { service, mail } = build();
    await registerVerified(service, mail);

    await expectAuthError(service.signIn("parent@example.com", "wrong-password-here"), "INVALID_CREDENTIALS");
    await expectAuthError(service.signIn("nobody@example.com", "wrong-password-here"), "INVALID_CREDENTIALS");
  });

  it("refuses an unconfirmed account", async () => {
    const { service } = build();
    await service.signUp({ email: "parent@example.com", firstName: "Sam", password: PASSWORD, acceptedTerms: true });
    await expectAuthError(service.signIn("parent@example.com", PASSWORD), "EMAIL_UNVERIFIED");
  });

  it("rate limits repeated failures and recovers in the next window", async () => {
    const { service, mail, clock } = build();
    await registerVerified(service, mail);

    for (let attempt = 0; attempt < 10; attempt += 1) {
      await expect(service.signIn("parent@example.com", "wrong-password-here")).rejects.toMatchObject({
        code: "INVALID_CREDENTIALS",
      });
    }
    await expectAuthError(service.signIn("parent@example.com", PASSWORD), "RATE_LIMITED");

    clock.advance(16 * 60 * 1000);
    await expect(service.signIn("parent@example.com", PASSWORD)).resolves.toMatchObject({ token: expect.any(String) });
  });
});

describe("session lifecycle", () => {
  it("resolves a valid token to its account and household", async () => {
    const { service, mail } = build();
    const token = await registerVerified(service, mail);
    await expect(service.authenticate(token)).resolves.toMatchObject({ emailVerified: true, firstName: "Sam" });
  });

  it("stops accepting a token the moment its session is revoked", async () => {
    const { service, mail } = build();
    const token = await registerVerified(service, mail);
    await service.signOut(token);
    await expectAuthError(service.authenticate(token), "SESSION_INVALID");
  });

  it("distinguishes an expired session from an invalid one", async () => {
    const { service, mail, clock } = build();
    const token = await registerVerified(service, mail);
    clock.advance(AUTH_DEFAULTS.sessionLifetimeMs + 1000);
    await expectAuthError(service.authenticate(token), "SESSION_EXPIRED");
    await expectAuthError(service.authenticate("pip_forged.signature"), "SESSION_INVALID");
  });

  it("treats signing out twice as harmless", async () => {
    const { service, mail } = build();
    const token = await registerVerified(service, mail);
    await service.signOut(token);
    await expect(service.signOut(token)).resolves.toBeUndefined();
  });
});

describe("password recovery", () => {
  it("says nothing about whether an address exists", async () => {
    const { service, mail } = build();
    await registerVerified(service, mail);
    await expect(service.requestPasswordReset("parent@example.com")).resolves.toBeUndefined();
    await expect(service.requestPasswordReset("nobody@example.com")).resolves.toBeUndefined();
    expect(mail.sent.filter((email) => email.kind === "password-reset")).toHaveLength(1);
  });

  it("resets the password and revokes every existing session", async () => {
    const { service, mail } = build();
    const oldToken = await registerVerified(service, mail);
    await service.requestPasswordReset("parent@example.com");

    const reset = [...mail.sent].reverse().find((email) => email.kind === "password-reset");
    if (!reset || reset.kind !== "password-reset") throw new Error("no reset email");

    await service.resetPassword(reset.resetToken, "brand-new-password");

    await expectAuthError(service.authenticate(oldToken), "SESSION_INVALID");
    await expect(service.signIn("parent@example.com", "brand-new-password")).resolves.toMatchObject({
      token: expect.any(String),
    });
  });

  it("refuses a reused, unknown, or expired reset token", async () => {
    const { service, mail, clock } = build();
    await registerVerified(service, mail);
    await service.requestPasswordReset("parent@example.com");
    const reset = [...mail.sent].reverse().find((email) => email.kind === "password-reset");
    if (!reset || reset.kind !== "password-reset") throw new Error("no reset email");

    await service.resetPassword(reset.resetToken, "brand-new-password");
    await expectAuthError(service.resetPassword(reset.resetToken, "another-new-password"), "RESET_INVALID");
    await expectAuthError(service.resetPassword("made-up-token", "another-new-password"), "RESET_INVALID");

    await service.requestPasswordReset("parent@example.com");
    const second = [...mail.sent].reverse().find((email) => email.kind === "password-reset");
    if (!second || second.kind !== "password-reset") throw new Error("no reset email");
    clock.advance(AUTH_DEFAULTS.resetLifetimeMs + 1000);
    await expectAuthError(service.resetPassword(second.resetToken, "another-new-password"), "RESET_INVALID");
  });

  it("still enforces the password rule on reset", async () => {
    const { service, mail } = build();
    await registerVerified(service, mail);
    await service.requestPasswordReset("parent@example.com");
    const reset = [...mail.sent].reverse().find((email) => email.kind === "password-reset");
    if (!reset || reset.kind !== "password-reset") throw new Error("no reset email");
    await expectAuthError(service.resetPassword(reset.resetToken, "short"), "WEAK_PASSWORD");
  });
});

describe("sensitive actions", () => {
  it("requires a recent password confirmation", async () => {
    const { service, mail, clock } = build();
    const token = await registerVerified(service, mail);

    await expect(service.requireRecentAuthentication(token)).resolves.toMatchObject({ firstName: "Sam" });

    clock.advance(AUTH_DEFAULTS.reauthenticationWindowMs + 1000);
    await expectAuthError(service.requireRecentAuthentication(token), "REAUTHENTICATION_REQUIRED");

    await service.reauthenticate(token, PASSWORD);
    await expect(service.requireRecentAuthentication(token)).resolves.toMatchObject({ firstName: "Sam" });
  });

  it("rejects re-authentication with the wrong password", async () => {
    const { service, mail } = build();
    const token = await registerVerified(service, mail);
    await expectAuthError(service.reauthenticate(token, "not-the-password"), "INVALID_CREDENTIALS");
  });

  it("returns the account to unverified after an email change", async () => {
    const { service, mail } = build();
    const token = await registerVerified(service, mail);

    await service.changeEmail(token, "new@example.com");

    const context = await service.authenticate(token);
    expect(context).toMatchObject({ email: "new@example.com", emailVerified: false });
    expect(await codeFor(mail)).toMatch(/^\d{6}$/);
  });

  it("does not disclose that a new address is already taken", async () => {
    const { service, mail } = build();
    await registerVerified(service, mail, "taken@example.com");
    const token = await registerVerified(service, mail, "parent@example.com");

    await expect(service.changeEmail(token, "taken@example.com")).resolves.toBeUndefined();
    await expect(service.authenticate(token)).resolves.toMatchObject({ email: "parent@example.com" });
  });
});

describe("household authorisation", () => {
  it("allows a member and refuses everyone else", async () => {
    const { service, mail } = build();
    const ownerToken = await registerVerified(service, mail, "owner@example.com");
    const owner = await service.authenticate(ownerToken);

    const intruderToken = await registerVerified(service, mail, "intruder@example.com");

    await expect(service.authorizeHousehold(ownerToken, owner.householdId)).resolves.toMatchObject({
      householdId: owner.householdId,
    });
    await expectAuthError(service.authorizeHousehold(intruderToken, owner.householdId), "FORBIDDEN");
  });

  it("refuses a household id that does not exist", async () => {
    const { service, mail } = build();
    const token = await registerVerified(service, mail);
    await expectAuthError(service.authorizeHousehold(token, "hh_made_up"), "FORBIDDEN");
  });

  it("refuses authorisation once the session is revoked", async () => {
    const { service, mail } = build();
    const token = await registerVerified(service, mail);
    const context = await service.authenticate(token);
    await service.signOut(token);
    await expectAuthError(service.authorizeHousehold(token, context.householdId), "SESSION_INVALID");
  });
});

describe("configuration", () => {
  it("demands real secrets in production", () => {
    expect(() => loadAuthConfig({ NODE_ENV: "production" })).toThrow(AuthConfigurationError);
    expect(() =>
      loadAuthConfig({ NODE_ENV: "production", PIP_SESSION_SECRET: "a", PIP_ONE_TIME_SECRET: "b" }),
    ).not.toThrow();
  });

  it("falls back to development secrets outside production", () => {
    expect(() => loadAuthConfig({})).not.toThrow();
  });

  it("rejects a nonsensical lifetime", () => {
    expect(() => loadAuthConfig({ PIP_SESSION_LIFETIME_MS: "-5" })).toThrow(AuthConfigurationError);
    expect(() => loadAuthConfig({ PIP_SESSION_LIFETIME_MS: "not-a-number" })).toThrow(AuthConfigurationError);
  });

  it("hides provider sign-in until a client id is configured", () => {
    const { service } = build();
    expect(service.availableProviders()).toEqual({ apple: false, google: false });

    const configured = new AuthService({
      config: loadAuthConfig({
        PIP_SESSION_SECRET: "s",
        PIP_ONE_TIME_SECRET: "o",
        PIP_APPLE_SIGN_IN_CLIENT_ID: "com.example.pip",
      }),
    });
    expect(configured.availableProviders()).toEqual({ apple: true, google: false });
  });
});
