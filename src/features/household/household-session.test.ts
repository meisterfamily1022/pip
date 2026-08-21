import { LOCAL_HOUSEHOLD_ID, runMigrations } from '@/database/migrations';
import { RealSqliteConnection } from '@/database/real-sqlite-connection.test-helper';
import type { DatabaseConnection } from '@/database/types';
import type { SessionState } from '@/features/auth/session-state';

import { backUpHouseholdToAccount, getActiveHouseholdId } from './household-scope';
import { syncHouseholdToSession } from './household-session';

let mockDatabase: DatabaseConnection;

jest.mock('@/database/client', () => ({
  __esModule: true,
  initializeDatabase: jest.fn(async () => mockDatabase),
}));

const PARENT_A = 'account-a';
const PARENT_B = 'account-b';

const signedIn = (accountId: string): SessionState => ({
  status: 'signedIn',
  account: { accountId, email: `${accountId}@example.test`, emailVerified: true },
  offline: false,
});
const signedOut: SessionState = { status: 'signedOut', account: null, offline: false };
const expired: SessionState = { status: 'expired', account: null, offline: false };

describe('household follows the session', () => {
  beforeEach(async () => {
    mockDatabase = new RealSqliteConnection();
    await runMigrations(mockDatabase);
  });

  it('returns the owner to their household when they sign in', async () => {
    await backUpHouseholdToAccount(mockDatabase, LOCAL_HOUSEHOLD_ID, PARENT_A);
    await syncHouseholdToSession(signedOut);
    expect(await getActiveHouseholdId(mockDatabase)).not.toBe(LOCAL_HOUSEHOLD_ID);

    await syncHouseholdToSession(signedIn(PARENT_A));

    expect(await getActiveHouseholdId(mockDatabase)).toBe(LOCAL_HOUSEHOLD_ID);
  });

  it('leaves an owned household behind on sign out', async () => {
    await backUpHouseholdToAccount(mockDatabase, LOCAL_HOUSEHOLD_ID, PARENT_A);

    await syncHouseholdToSession(signedOut);

    expect(await getActiveHouseholdId(mockDatabase)).not.toBe(LOCAL_HOUSEHOLD_ID);
  });

  it('treats a rejected session as signed out rather than still trusted', async () => {
    await backUpHouseholdToAccount(mockDatabase, LOCAL_HOUSEHOLD_ID, PARENT_A);
    await syncHouseholdToSession(signedIn(PARENT_A));

    await syncHouseholdToSession(expired);

    expect(await getActiveHouseholdId(mockDatabase)).not.toBe(LOCAL_HOUSEHOLD_ID);
  });

  it('settles on the last account when a switch fires transitions back to back', async () => {
    await backUpHouseholdToAccount(mockDatabase, LOCAL_HOUSEHOLD_ID, PARENT_A);

    // Sign out and sign in as somebody else, without awaiting in between.
    const first = syncHouseholdToSession(signedOut);
    const second = syncHouseholdToSession(signedIn(PARENT_B));
    await Promise.all([first, second]);

    const active = await getActiveHouseholdId(mockDatabase);
    expect(active).not.toBe(LOCAL_HOUSEHOLD_ID);
    const owner = await mockDatabase.getFirstAsync<{ owner_account_id: string | null }>(
      'SELECT owner_account_id FROM households WHERE id = ?;',
      active,
    );
    // B has not backed anything up, so they are on an unowned library — never A's.
    expect(owner?.owner_account_id).toBeNull();
  });
});
