import { LOCAL_HOUSEHOLD_ID, runMigrations } from '@/database/migrations';
import { RealSqliteConnection } from '@/database/real-sqlite-connection.test-helper';
import type { DatabaseConnection } from '@/database/types';
import type { SessionState } from '@/features/auth/session-state';
import { backUpHouseholdToAccount } from '@/features/household/household-scope';

import { loadAccountStatus, signOutConsequence, switchAccountConsequence } from './account-status';

const ACCOUNT = 'account-a';
const signedIn: SessionState = {
  status: 'signedIn',
  account: { accountId: ACCOUNT, email: 'parent@example.test', emailVerified: true },
  offline: false,
};
const signedOut: SessionState = { status: 'signedOut', account: null, offline: false };

let database: DatabaseConnection;

beforeEach(async () => {
  database = new RealSqliteConnection();
  await runMigrations(database);
});

describe('account status', () => {
  it('reports signed out with no email when there is no session', async () => {
    const status = await loadAccountStatus(database, signedOut);

    expect(status.signedIn).toBe(false);
    expect(status.email).toBeNull();
    expect(status.householdLinked).toBe(false);
  });

  it('shows the authenticated email when signed in', async () => {
    const status = await loadAccountStatus(database, signedIn);

    expect(status.signedIn).toBe(true);
    expect(status.email).toBe('parent@example.test');
  });

  it('does not call an unowned library linked merely because somebody is signed in', async () => {
    const status = await loadAccountStatus(database, signedIn);

    expect(status.householdLinked).toBe(false);
  });

  it('reports the library as linked once it has been backed up to this account', async () => {
    await backUpHouseholdToAccount(database, LOCAL_HOUSEHOLD_ID, ACCOUNT);

    const status = await loadAccountStatus(database, signedIn);

    expect(status.householdLinked).toBe(true);
  });

  it('does not report another account\'s library as linked to this one', async () => {
    await backUpHouseholdToAccount(database, LOCAL_HOUSEHOLD_ID, 'somebody-else');

    const status = await loadAccountStatus(database, signedIn);

    expect(status.householdLinked).toBe(false);
  });
});

describe('sign-out consequences', () => {
  it('promises nothing is deleted for an unlinked library', async () => {
    const status = await loadAccountStatus(database, signedIn);

    expect(signOutConsequence(status)).toContain('Nothing is deleted');
    expect(signOutConsequence(status)).not.toContain('hidden');
  });

  it('says a linked library will be hidden, and still says nothing is deleted', async () => {
    await backUpHouseholdToAccount(database, LOCAL_HOUSEHOLD_ID, ACCOUNT);
    const status = await loadAccountStatus(database, signedIn);

    const message = signOutConsequence(status);
    expect(message).toContain('hidden until you sign in again');
    expect(message).toContain('nothing is deleted');
  });

  it('warns that a linked library will be hidden from the next account', async () => {
    await backUpHouseholdToAccount(database, LOCAL_HOUSEHOLD_ID, ACCOUNT);
    const status = await loadAccountStatus(database, signedIn);

    expect(switchAccountConsequence(status)).toContain('hidden from them');
  });
});
