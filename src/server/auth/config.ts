/**
 * Auth configuration and environment validation.
 *
 * Secrets are read once at the boundary and validated loudly. A deployment that
 * forgets a signing secret should fail immediately with a clear message, not
 * silently issue tokens signed with an empty string.
 */

export type AuthConfig = {
  sessionSecret: string;
  /** Separate from the session secret so codes and tokens are not interchangeable. */
  oneTimeSecret: string;
  sessionLifetimeMs: number;
  verificationLifetimeMs: number;
  resetLifetimeMs: number;
  /** Sensitive actions require a password confirmation newer than this. */
  reauthenticationWindowMs: number;
  appleSignInEnabled: boolean;
  googleSignInEnabled: boolean;
};

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

export const AUTH_DEFAULTS = {
  sessionLifetimeMs: 30 * DAY,
  verificationLifetimeMs: 24 * HOUR,
  resetLifetimeMs: HOUR,
  reauthenticationWindowMs: 10 * 60 * 1000,
} as const;

export class AuthConfigurationError extends Error {}

/** Development-only fallbacks, used when a secret is absent outside production. */
const DEVELOPMENT_SECRET = 'pip-development-secret-do-not-use-in-production';

export function loadAuthConfig(
  environment: Record<string, string | undefined> = process.env,
): AuthConfig {
  const isProduction = environment.NODE_ENV === 'production';

  const required = (name: string): string => {
    const value = environment[name]?.trim();
    if (value) return value;
    if (isProduction) {
      throw new AuthConfigurationError(
        `${name} is required in production. Set it in the deployment environment; see .env.example.`,
      );
    }
    return DEVELOPMENT_SECRET;
  };

  const positiveInteger = (name: string, fallback: number): number => {
    const raw = environment[name];
    if (raw === undefined || raw.trim() === '') return fallback;
    const parsed = Number(raw);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      throw new AuthConfigurationError(`${name} must be a positive number of milliseconds.`);
    }
    return parsed;
  };

  return {
    sessionSecret: required('PIP_SESSION_SECRET'),
    oneTimeSecret: required('PIP_ONE_TIME_SECRET'),
    sessionLifetimeMs: positiveInteger('PIP_SESSION_LIFETIME_MS', AUTH_DEFAULTS.sessionLifetimeMs),
    verificationLifetimeMs: positiveInteger('PIP_VERIFICATION_LIFETIME_MS', AUTH_DEFAULTS.verificationLifetimeMs),
    resetLifetimeMs: positiveInteger('PIP_RESET_LIFETIME_MS', AUTH_DEFAULTS.resetLifetimeMs),
    reauthenticationWindowMs: positiveInteger('PIP_REAUTH_WINDOW_MS', AUTH_DEFAULTS.reauthenticationWindowMs),
    // Provider buttons stay hidden until real credentials exist, so the UI
    // never offers a sign-in method that cannot complete.
    appleSignInEnabled: Boolean(environment.PIP_APPLE_SIGN_IN_CLIENT_ID?.trim()),
    googleSignInEnabled: Boolean(environment.PIP_GOOGLE_SIGN_IN_CLIENT_ID?.trim()),
  };
}

/** Rate limits, expressed as attempts per rolling window. */
export const RATE_LIMITS = {
  signIn: { limit: 10, windowMs: 15 * 60 * 1000 },
  verification: { limit: 6, windowMs: 15 * 60 * 1000 },
  resend: { limit: 5, windowMs: 60 * 60 * 1000 },
  passwordReset: { limit: 5, windowMs: 60 * 60 * 1000 },
} as const;
