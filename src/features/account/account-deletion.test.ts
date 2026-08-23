import { LOCAL_HOUSEHOLD_ID, runMigrations } from '@/database/migrations';
import { RealSqliteConnection } from '@/database/real-sqlite-connection.test-helper';
import type { DatabaseConnection } from '@/database/types';
import { activateHouseholdForAccount, backUpHouseholdToAccount, getActiveHouseholdId } from '@/features/household/household-scope';
import { listParentToys } from '@/repositories/toys-repository';
import { getHousehold } from '@/repositories/households-repository';

import {
  AccountDeletionError,
  DELETION_CONSEQUENCES,
  DELETION_UNAVAILABLE_NOTE,
  deleteAccountAndSettleDevice,
  deleteAccountWithPin,
  readDeletionAvailability,
  type AccountDeletionGateway,
} from './account-deletion';
import type { PinStorage } from '@/services/pin-storage';

const ACCOUNT = 'account-a';

let database: DatabaseConnection;
let signedOut: boolean;

const signOut = async (): Promise<void> => {
  signedOut = true;
  await activateHouseholdForAccount(database, null);
};

const gateway = (
  availability: 'available' | 'not-configured',
  deleteImpl: () => Promise<void> = async () => undefined,
): AccountDeletionGateway => ({ availability, deleteAuthenticatedAccount: jest.fn(deleteImpl) });

async function seedToy(): Promise<void> {
  await database.runAsync(
    `INSERT INTO rooms (name, created_at, updated_at, household_id) VALUES ('Playroom', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, ?);`,
    LOCAL_HOUSEHOLD_ID,
  );
  await database.runAsync(
    `INSERT INTO storage_spots (room_id, name, created_at, updated_at, household_id) VALUES (1, 'Shelf', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, ?);`,
    LOCAL_HOUSEHOLD_ID,
  );
  await database.runAsync(
    `INSERT INTO toys (name, image_uri, room_id, storage_spot_id, is_available, is_archived, created_at, updated_at, household_id)
     VALUES ('Wooden train', NULL, 1, 1, 1, 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, ?);`,
    LOCAL_HOUSEHOLD_ID,
  );
}

beforeEach(async () => {
  database = new RealSqliteConnection();
  await runMigrations(database);
  signedOut = false;
});

describe('deletion availability', () => {
  it('is not configured without an explicit deployment flag', () => {
    expect(readDeletionAvailability(undefined, true)).toBe('not-configured');
    expect(readDeletionAvailability('0', true)).toBe('not-configured');
  });

  it('is not configured when Supabase itself is absent, flag or not', () => {
    expect(readDeletionAvailability('1', false)).toBe('not-configured');
  });

  it('is available only when a function is declared deployed', () => {
    expect(readDeletionAvailability('1', true)).toBe('available');
  });
});

describe('deleting an account', () => {
  it('refuses, and says why, when no deletion service is deployed', async () => {
    const unavailable = gateway('not-configured');

    await expect(deleteAccountAndSettleDevice(database, ACCOUNT, unavailable, signOut)).rejects.toThrow(
      AccountDeletionError,
    );
    expect(unavailable.deleteAuthenticatedAccount).not.toHaveBeenCalled();
    expect(signedOut).toBe(false);
  });

  it('changes nothing locally when the server call fails', async () => {
    await seedToy();
    await backUpHouseholdToAccount(database, LOCAL_HOUSEHOLD_ID, ACCOUNT);
    const failing = gateway('available', async () => {
      throw new AccountDeletionError('Network unreachable.');
    });

    await expect(deleteAccountAndSettleDevice(database, ACCOUNT, failing, signOut)).rejects.toThrow('Network unreachable.');

    // Still owned, still signed in: nothing to undo, and nothing was undone.
    expect((await getHousehold(database, LOCAL_HOUSEHOLD_ID))?.ownerAccountId).toBe(ACCOUNT);
    expect(signedOut).toBe(false);
  });

  it('signs the parent out once the account is genuinely gone', async () => {
    await backUpHouseholdToAccount(database, LOCAL_HOUSEHOLD_ID, ACCOUNT);
    const ok = gateway('available');

    await deleteAccountAndSettleDevice(database, ACCOUNT, ok, signOut);

    expect(ok.deleteAuthenticatedAccount).toHaveBeenCalledTimes(1);
    expect(signedOut).toBe(true);
  });

  it('keeps the family library on the device and reachable afterwards', async () => {
    await seedToy();
    await backUpHouseholdToAccount(database, LOCAL_HOUSEHOLD_ID, ACCOUNT);

    const result = await deleteAccountAndSettleDevice(database, ACCOUNT, gateway('available'), signOut);

    expect(result.householdUnlinked).toBe(true);
    const household = await getHousehold(database, LOCAL_HOUSEHOLD_ID);
    expect(household?.ownerAccountId).toBeNull();
    // The point of unlinking before signing out: still the active library, and
    // still readable, by a device with no account at all.
    expect(await getActiveHouseholdId(database)).toBe(LOCAL_HOUSEHOLD_ID);
    expect(await listParentToys(database)).toHaveLength(1);
  });

  it('does not unlink a library belonging to a different account', async () => {
    await backUpHouseholdToAccount(database, LOCAL_HOUSEHOLD_ID, 'somebody-else');
    await activateHouseholdForAccount(database, 'somebody-else');

    const result = await deleteAccountAndSettleDevice(database, ACCOUNT, gateway('available'), signOut);

    expect(result.householdUnlinked).toBe(false);
    expect((await getHousehold(database, LOCAL_HOUSEHOLD_ID))?.ownerAccountId).toBe('somebody-else');
  });
});

describe('what the parent is told', () => {
  it('promises deletion of the account, and explicitly not of the library', () => {
    const copy = DELETION_CONSEQUENCES.join(' ');

    expect(copy).toContain('account');
    expect(copy).toMatch(/stay on this iPhone/i);
    expect(copy).toMatch(/cannot be undone/i);
  });

  it('states plainly that deletion is unavailable rather than hedging', () => {
    expect(DELETION_UNAVAILABLE_NOTE).toMatch(/not available/i);
    expect(DELETION_UNAVAILABLE_NOTE).not.toMatch(/coming soon|shortly|in a future/i);
  });
});

describe('the parent PIN gate', () => {
  const pins = (stored: string | null): PinStorage => ({
    getPin: async () => stored,
    savePin: async () => undefined,
    deletePin: async () => undefined,
  });

  it('refuses a wrong PIN without contacting the server at all', async () => {
    const ok = gateway('available');

    await expect(
      deleteAccountWithPin(database, ACCOUNT, '0000', ok, signOut, pins('1234')),
    ).rejects.toThrow(/PIN does not match/);

    expect(ok.deleteAuthenticatedAccount).not.toHaveBeenCalled();
    expect(signedOut).toBe(false);
  });

  it('checks availability before the PIN, so an impossible action never asks for one', async () => {
    const unavailable = gateway('not-configured');

    await expect(
      deleteAccountWithPin(database, ACCOUNT, '1234', unavailable, signOut, pins('1234')),
    ).rejects.toThrow(/not available/i);
  });

  it('deletes once the PIN matches', async () => {
    await backUpHouseholdToAccount(database, LOCAL_HOUSEHOLD_ID, ACCOUNT);
    const ok = gateway('available');

    await deleteAccountWithPin(database, ACCOUNT, '1234', ok, signOut, pins('1234'));

    expect(ok.deleteAuthenticatedAccount).toHaveBeenCalledTimes(1);
    expect(signedOut).toBe(true);
  });
});
