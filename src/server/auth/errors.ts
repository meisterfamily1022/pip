export const AUTH_ERROR_CODES = [
  'INVALID_REQUEST',
  'WEAK_PASSWORD',
  'INVALID_CREDENTIALS',
  'EMAIL_UNVERIFIED',
  'VERIFICATION_INVALID',
  'RESET_INVALID',
  'SESSION_INVALID',
  'SESSION_EXPIRED',
  'REAUTHENTICATION_REQUIRED',
  'FORBIDDEN',
  'RATE_LIMITED',
  'EMAIL_UNAVAILABLE',
  'PROVIDER_UNAVAILABLE',
  'INTERNAL_ERROR',
] as const;

export type AuthErrorCode = (typeof AUTH_ERROR_CODES)[number];

/**
 * Normalised responses for every auth failure.
 *
 * Two rules shape these messages:
 *
 * - **No account enumeration.** Nothing here reveals whether an address is
 *   registered. A wrong password and an unknown address both return
 *   `INVALID_CREDENTIALS` with identical wording, and sign-up with an existing
 *   address returns the same "check your email" success shape as a new one.
 * - **No internal detail.** Messages are what a parent should read; codes are
 *   what the client branches on. Provider names, stack traces and record ids
 *   never reach the response.
 */
const defaults: Record<AuthErrorCode, { message: string; retryable: boolean; status: number }> = {
  INVALID_REQUEST: { message: 'Check the details and try again.', retryable: false, status: 400 },
  WEAK_PASSWORD: { message: 'Choose a password with at least 10 characters.', retryable: false, status: 400 },
  INVALID_CREDENTIALS: { message: 'That email or password is not correct.', retryable: false, status: 401 },
  EMAIL_UNVERIFIED: { message: 'Confirm your email address to continue.', retryable: false, status: 403 },
  VERIFICATION_INVALID: { message: 'That confirmation code has expired or is not valid.', retryable: false, status: 400 },
  RESET_INVALID: { message: 'That reset link has expired or is not valid.', retryable: false, status: 400 },
  SESSION_INVALID: { message: 'Sign in to continue.', retryable: false, status: 401 },
  SESSION_EXPIRED: { message: 'Your session ended. Sign in to continue.', retryable: false, status: 401 },
  REAUTHENTICATION_REQUIRED: { message: 'Confirm your password to continue.', retryable: false, status: 401 },
  FORBIDDEN: { message: 'You do not have access to that.', retryable: false, status: 403 },
  RATE_LIMITED: { message: 'Too many attempts. Wait a moment and try again.', retryable: true, status: 429 },
  EMAIL_UNAVAILABLE: { message: 'We could not send that email. Try again shortly.', retryable: true, status: 503 },
  PROVIDER_UNAVAILABLE: { message: 'That sign-in method is unavailable right now.', retryable: true, status: 503 },
  INTERNAL_ERROR: { message: 'Something went wrong. Try again shortly.', retryable: true, status: 500 },
};

export class AuthApplicationError extends Error {
  readonly code: AuthErrorCode;
  readonly retryable: boolean;
  readonly status: number;
  readonly requestId: string;

  constructor(code: AuthErrorCode, requestId: string) {
    super(defaults[code].message);
    this.name = 'AuthApplicationError';
    this.code = code;
    this.retryable = defaults[code].retryable;
    this.status = defaults[code].status;
    this.requestId = requestId;
  }
}

/** The only shape an auth route may return on failure. */
export function safeAuthErrorBody(error: AuthApplicationError) {
  return {
    error: {
      code: error.code,
      message: error.message,
      requestId: error.requestId,
      retryable: error.retryable,
    },
  };
}
