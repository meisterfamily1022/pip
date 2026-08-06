/**
 * Server-side auth persistence.
 *
 * Mirrors the shape of `server/ai/durable-control`: repository interfaces plus
 * an in-memory implementation for local development and tests. A deployment
 * swaps in a durable implementation without touching the service layer.
 */

export type AccountRecord = {
  accountId: string;
  /** Stored lowercased; `emailKey` is what uniqueness is enforced on. */
  email: string;
  emailKey: string;
  firstName: string;
  /** Absent for provider-only accounts (Apple/Google). */
  passwordHash?: string;
  emailVerifiedAt?: string;
  createdAt: string;
  updatedAt: string;
};

export type HouseholdRecord = {
  householdId: string;
  name: string;
  createdAt: string;
};

export type MembershipRecord = {
  householdId: string;
  accountId: string;
  role: 'owner' | 'adult';
  createdAt: string;
};

export type SessionRecord = {
  sessionId: string;
  accountId: string;
  createdAt: string;
  expiresAt: string;
  /** Set when signed out or revoked. A revoked session is never resurrected. */
  revokedAt?: string;
  /** Most recent password confirmation, for sensitive-action re-auth. */
  reauthenticatedAt: string;
};

export type VerificationRecord = {
  accountId: string;
  codeHash: string;
  expiresAt: string;
  attempts: number;
};

export type ResetRecord = {
  tokenHash: string;
  accountId: string;
  expiresAt: string;
  usedAt?: string;
};

export interface AccountRepository {
  create(record: AccountRecord): Promise<void>;
  remove(accountId: string): Promise<void>;
  get(accountId: string): Promise<AccountRecord | undefined>;
  findByEmail(emailKey: string): Promise<AccountRecord | undefined>;
  update(record: AccountRecord): Promise<void>;
}

export interface HouseholdRepository {
  create(household: HouseholdRecord, ownerAccountId: string, createdAt: string): Promise<void>;
  get(householdId: string): Promise<HouseholdRecord | undefined>;
  rename(householdId: string, name: string): Promise<void>;
  listForAccount(accountId: string): Promise<HouseholdRecord[]>;
  membership(householdId: string, accountId: string): Promise<MembershipRecord | undefined>;
}

export interface SessionRepository {
  create(record: SessionRecord): Promise<void>;
  get(sessionId: string): Promise<SessionRecord | undefined>;
  update(record: SessionRecord): Promise<void>;
  revokeAllForAccount(accountId: string, revokedAt: string): Promise<void>;
}

export interface VerificationRepository {
  put(record: VerificationRecord): Promise<void>;
  get(accountId: string): Promise<VerificationRecord | undefined>;
  delete(accountId: string): Promise<void>;
}

export interface ResetRepository {
  put(record: ResetRecord): Promise<void>;
  get(tokenHash: string): Promise<ResetRecord | undefined>;
  update(record: ResetRecord): Promise<void>;
}

/** Counts attempts per key inside a rolling window. */
export interface RateLimitRepository {
  hit(key: string, windowStart: string): Promise<number>;
  reset(key: string): Promise<void>;
}

export interface AuthStorage {
  accounts: AccountRepository;
  households: HouseholdRepository;
  sessions: SessionRepository;
  verifications: VerificationRepository;
  resets: ResetRepository;
  rateLimits: RateLimitRepository;
}

type AuthState = {
  accounts: Map<string, AccountRecord>;
  emails: Map<string, string>;
  households: Map<string, HouseholdRecord>;
  memberships: Map<string, MembershipRecord>;
  sessions: Map<string, SessionRecord>;
  verifications: Map<string, VerificationRecord>;
  resets: Map<string, ResetRecord>;
  rateLimits: Map<string, { windowStart: string; count: number }>;
};

const globalKey = '__pipAuthState';

function state(): AuthState {
  const root = globalThis as typeof globalThis & { [globalKey]?: AuthState };
  if (!root[globalKey]) {
    root[globalKey] = {
      accounts: new Map(),
      emails: new Map(),
      households: new Map(),
      memberships: new Map(),
      sessions: new Map(),
      verifications: new Map(),
      resets: new Map(),
      rateLimits: new Map(),
    };
  }
  return root[globalKey];
}

export function resetAuthStorageForTests(): void {
  const root = globalThis as typeof globalThis & { [globalKey]?: AuthState };
  delete root[globalKey];
}

const membershipKey = (householdId: string, accountId: string): string => `${householdId}:${accountId}`;

/** In-memory storage for local development and tests. Not for production. */
export class LocalDevelopmentAuthStorage implements AuthStorage {
  private readonly data = state();

  readonly accounts: AccountRepository = {
    create: async (record) => {
      this.data.accounts.set(record.accountId, { ...record });
      this.data.emails.set(record.emailKey, record.accountId);
    },
    remove: async (accountId) => {
      const existing = this.data.accounts.get(accountId);
      if (!existing) return;
      this.data.accounts.delete(accountId);
      this.data.emails.delete(existing.emailKey);
      for (const [key, membership] of this.data.memberships) {
        if (membership.accountId === accountId) this.data.memberships.delete(key);
      }
    },
    get: async (accountId) => this.data.accounts.get(accountId),
    findByEmail: async (emailKey) => {
      const accountId = this.data.emails.get(emailKey);
      return accountId ? this.data.accounts.get(accountId) : undefined;
    },
    update: async (record) => {
      const existing = this.data.accounts.get(record.accountId);
      if (existing && existing.emailKey !== record.emailKey) this.data.emails.delete(existing.emailKey);
      this.data.accounts.set(record.accountId, { ...record });
      this.data.emails.set(record.emailKey, record.accountId);
    },
  };

  readonly households: HouseholdRepository = {
    create: async (household, ownerAccountId, createdAt) => {
      this.data.households.set(household.householdId, { ...household });
      this.data.memberships.set(membershipKey(household.householdId, ownerAccountId), {
        householdId: household.householdId,
        accountId: ownerAccountId,
        role: 'owner',
        createdAt,
      });
    },
    get: async (householdId) => this.data.households.get(householdId),
    rename: async (householdId, name) => {
      const existing = this.data.households.get(householdId);
      if (existing) this.data.households.set(householdId, { ...existing, name });
    },
    listForAccount: async (accountId) =>
      [...this.data.memberships.values()]
        .filter((membership) => membership.accountId === accountId)
        .map((membership) => this.data.households.get(membership.householdId))
        .filter((household): household is HouseholdRecord => household !== undefined),
    membership: async (householdId, accountId) => this.data.memberships.get(membershipKey(householdId, accountId)),
  };

  readonly sessions: SessionRepository = {
    create: async (record) => {
      this.data.sessions.set(record.sessionId, { ...record });
    },
    get: async (sessionId) => this.data.sessions.get(sessionId),
    update: async (record) => {
      this.data.sessions.set(record.sessionId, { ...record });
    },
    revokeAllForAccount: async (accountId, revokedAt) => {
      for (const session of this.data.sessions.values()) {
        if (session.accountId === accountId && !session.revokedAt) session.revokedAt = revokedAt;
      }
    },
  };

  readonly verifications: VerificationRepository = {
    put: async (record) => {
      this.data.verifications.set(record.accountId, { ...record });
    },
    get: async (accountId) => this.data.verifications.get(accountId),
    delete: async (accountId) => {
      this.data.verifications.delete(accountId);
    },
  };

  readonly resets: ResetRepository = {
    put: async (record) => {
      this.data.resets.set(record.tokenHash, { ...record });
    },
    get: async (tokenHash) => this.data.resets.get(tokenHash),
    update: async (record) => {
      this.data.resets.set(record.tokenHash, { ...record });
    },
  };

  readonly rateLimits: RateLimitRepository = {
    hit: async (key, windowStart) => {
      const existing = this.data.rateLimits.get(key);
      if (!existing || existing.windowStart !== windowStart) {
        this.data.rateLimits.set(key, { windowStart, count: 1 });
        return 1;
      }
      existing.count += 1;
      return existing.count;
    },
    reset: async (key) => {
      this.data.rateLimits.delete(key);
    },
  };
}
