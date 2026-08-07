import { createHmac, randomBytes, randomUUID, scryptSync, timingSafeEqual } from 'node:crypto';

/**
 * Password hashing, session tokens, and one-time codes.
 *
 * Every comparison here uses `timingSafeEqual` so a response time cannot leak
 * how much of a secret was correct. Nothing in this module logs, and callers
 * must not log its inputs or outputs.
 */

/** scrypt work factor. Deliberately memory-hard; raising N is the tuning lever. */
const SCRYPT = { N: 16_384, r: 8, p: 1, keyLength: 64 } as const;
const HASH_PREFIX = 'scrypt$1';

export const MINIMUM_PASSWORD_LENGTH = 8;

function constantTimeEquals(left: string, right: string): boolean {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  // Length is compared first because timingSafeEqual throws on a mismatch. The
  // length of a hash or token is not secret.
  return a.length === b.length && timingSafeEqual(a, b);
}

/** True when the password satisfies the only rule the product enforces. */
export function isAcceptablePassword(password: string): boolean {
  return password.length >= MINIMUM_PASSWORD_LENGTH;
}

/**
 * Hashes a password with a per-account random salt.
 *
 * The stored form carries its own parameters, so the work factor can be raised
 * later without invalidating existing hashes.
 */
export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString('base64url');
  const derived = scryptSync(password, salt, SCRYPT.keyLength, { N: SCRYPT.N, r: SCRYPT.r, p: SCRYPT.p });
  return `${HASH_PREFIX}$${SCRYPT.N}$${SCRYPT.r}$${SCRYPT.p}$${salt}$${derived.toString('base64url')}`;
}

/** Verifies a password against a stored hash. Never throws on malformed input. */
export function verifyPassword(password: string, stored: string): boolean {
  const parts = stored.split('$');
  if (parts.length !== 7 || `${parts[0]}$${parts[1]}` !== HASH_PREFIX) return false;
  const [, , n, r, p, salt, expected] = parts;
  try {
    const derived = scryptSync(password, salt, SCRYPT.keyLength, { N: Number(n), r: Number(r), p: Number(p) });
    return constantTimeEquals(derived.toString('base64url'), expected);
  } catch {
    return false;
  }
}

/**
 * A dummy verification used when no account matches.
 *
 * Sign-in must take comparable time whether or not the address exists,
 * otherwise response timing reveals which addresses are registered.
 */
const DECOY_HASH = hashPassword(`decoy-${randomBytes(16).toString('hex')}`);

export function burnPasswordComparison(password: string): void {
  verifyPassword(password, DECOY_HASH);
}

/* ------------------------------------------------------------------ tokens */

export type SessionTokenPayload = {
  sessionId: string;
  accountId: string;
  issuedAt: string;
};

/**
 * Signs and verifies opaque session tokens.
 *
 * The token carries the session id; the server still loads that session on
 * every request, so revoking a session takes effect immediately rather than
 * waiting for the token to expire.
 */
export class SessionTokenSigner {
  constructor(private readonly secret: string) {
    if (!secret) throw new Error('A session signing secret is required.');
  }

  issue(payload: SessionTokenPayload): string {
    const body = Buffer.from(JSON.stringify({ v: 1, s: payload.sessionId, a: payload.accountId, t: payload.issuedAt })).toString(
      'base64url',
    );
    return `pip_${body}.${this.sign(body)}`;
  }

  verify(token: string): SessionTokenPayload | undefined {
    if (typeof token !== 'string' || token.length > 1024 || !token.startsWith('pip_')) return undefined;
    const encoded = token.slice(4);
    const separator = encoded.indexOf('.');
    if (separator < 1) return undefined;
    const body = encoded.slice(0, separator);
    if (!constantTimeEquals(encoded.slice(separator + 1), this.sign(body))) return undefined;
    try {
      const value = JSON.parse(Buffer.from(body, 'base64url').toString('utf8')) as {
        v?: number;
        s?: string;
        a?: string;
        t?: string;
      };
      if (value.v !== 1 || typeof value.s !== 'string' || typeof value.a !== 'string' || typeof value.t !== 'string') {
        return undefined;
      }
      return { sessionId: value.s, accountId: value.a, issuedAt: value.t };
    } catch {
      return undefined;
    }
  }

  private sign(value: string): string {
    return createHmac('sha256', this.secret).update(value).digest('base64url');
  }
}

/* ------------------------------------------------------------- one-time codes */

/** Six digits, the format the brief specifies for email confirmation. */
export function newVerificationCode(): string {
  return String(randomBytes(4).readUInt32BE(0) % 1_000_000).padStart(6, '0');
}

/**
 * Codes and reset tokens are stored hashed.
 *
 * A leaked database snapshot then cannot be used to confirm an address or
 * complete a password reset.
 */
export function hashOneTimeSecret(value: string, secret: string): string {
  return createHmac('sha256', secret).update(value).digest('base64url');
}

export function oneTimeSecretMatches(value: string, storedHash: string, secret: string): boolean {
  return constantTimeEquals(hashOneTimeSecret(value, secret), storedHash);
}

export function newResetToken(): string {
  return randomBytes(32).toString('base64url');
}

export function newId(prefix: string): string {
  return `${prefix}_${randomUUID().replace(/-/g, '')}`;
}
