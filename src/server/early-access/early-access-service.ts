/**
 * Early-access registration.
 *
 * Pip has no App Store listing yet, so the landing page's only truthful call to
 * action is "join early access". This backs it with a real endpoint rather than
 * a dead button.
 *
 * Deliberately minimal: an address, a consent flag, and a timestamp. No name,
 * no child details, no tracking identifiers.
 */

export type EarlyAccessSignup = {
  emailKey: string;
  email: string;
  createdAt: string;
};

export type EarlyAccessResult = {
  /** Always true. Never reveals whether the address was already registered. */
  registered: true;
};

export interface EarlyAccessRepository {
  put(signup: EarlyAccessSignup): Promise<void>;
  get(emailKey: string): Promise<EarlyAccessSignup | undefined>;
  count(): Promise<number>;
}

export interface EarlyAccessClock {
  now(): Date;
}

const globalKey = '__pipEarlyAccess';

function store(): Map<string, EarlyAccessSignup> {
  const root = globalThis as typeof globalThis & { [globalKey]?: Map<string, EarlyAccessSignup> };
  if (!root[globalKey]) root[globalKey] = new Map();
  return root[globalKey];
}

export function resetEarlyAccessForTests(): void {
  const root = globalThis as typeof globalThis & { [globalKey]?: Map<string, EarlyAccessSignup> };
  delete root[globalKey];
}

export class LocalDevelopmentEarlyAccessRepository implements EarlyAccessRepository {
  private readonly data = store();

  async put(signup: EarlyAccessSignup): Promise<void> {
    this.data.set(signup.emailKey, { ...signup });
  }

  async get(emailKey: string): Promise<EarlyAccessSignup | undefined> {
    return this.data.get(emailKey);
  }

  async count(): Promise<number> {
    return this.data.size;
  }
}

export class EarlyAccessValidationError extends Error {}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_EMAIL_LENGTH = 254;

export type EarlyAccessInput = {
  email: string;
  acceptedUpdates: boolean;
  /**
   * Hidden field that real people leave empty. A filled value means a bot, and
   * the request is accepted-looking but discarded.
   */
  honeypot?: string;
};

export class EarlyAccessService {
  constructor(
    private readonly repository: EarlyAccessRepository = new LocalDevelopmentEarlyAccessRepository(),
    private readonly clock: EarlyAccessClock = { now: () => new Date() },
  ) {}

  /**
   * Records an address.
   *
   * Registering twice is a no-op that reports the same success, so the endpoint
   * cannot be used to test whether an address is on the list, and an impatient
   * double-tap does not create a duplicate.
   */
  async register(input: EarlyAccessInput): Promise<EarlyAccessResult> {
    if (!input.acceptedUpdates) {
      throw new EarlyAccessValidationError('Tick the box to let us email you when Pip is ready.');
    }

    const email = input.email.trim();
    if (!email || email.length > MAX_EMAIL_LENGTH || !EMAIL_PATTERN.test(email)) {
      throw new EarlyAccessValidationError('Enter an email address we can reach you at.');
    }

    // Silently accept and drop obvious bot submissions.
    if (input.honeypot && input.honeypot.trim() !== '') return { registered: true };

    const emailKey = email.toLowerCase();
    const existing = await this.repository.get(emailKey);
    if (existing) return { registered: true };

    await this.repository.put({ emailKey, email, createdAt: this.clock.now().toISOString() });
    return { registered: true };
  }
}
