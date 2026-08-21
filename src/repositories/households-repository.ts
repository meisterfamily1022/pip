import type { DatabaseConnection } from '@/database/types';
import type { HouseholdRow } from '@/database/rows';
import type { Household } from '@/domain/models';
import { LOCAL_HOUSEHOLD_ID } from '@/database/migrations';

/**
 * The household this device's library belongs to.
 *
 * Every device has exactly one until account sharing lands. Migration 9 creates
 * it, so reads here never have to cope with its absence on a migrated database.
 */

const now = (): string => new Date().toISOString();

const toHousehold = (row: HouseholdRow): Household => ({
  id: row.id,
  name: row.name,
  isLocalOnly: row.is_local_only === 1,
  remoteId: row.remote_id,
  ownerAccountId: row.owner_account_id,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

const COLUMNS = 'id, name, is_local_only, remote_id, owner_account_id, created_at, updated_at';

export async function getHousehold(database: DatabaseConnection, id: string): Promise<Household | null> {
  const row = await database.getFirstAsync<HouseholdRow>(`SELECT ${COLUMNS} FROM households WHERE id = ?;`, id);
  return row ? toHousehold(row) : null;
}

/** The household that owns everything created before accounts existed. */
export async function getLocalHousehold(database: DatabaseConnection): Promise<Household> {
  const household = await getHousehold(database, LOCAL_HOUSEHOLD_ID);
  if (!household) throw new Error('This device has no household yet.');
  return household;
}

export async function renameHousehold(database: DatabaseConnection, id: string, name: string): Promise<Household> {
  const trimmed = name.trim();
  if (!trimmed) throw new Error('Give your Pip a name.');
  const result = await database.runAsync('UPDATE households SET name = ?, updated_at = ? WHERE id = ?;', trimmed, now(), id);
  if (result.changes !== 1) throw new Error('Household not found.');
  const household = await getHousehold(database, id);
  if (!household) throw new Error('Household could not be loaded.');
  return household;
}

/**
 * Links the local household to its server-side record.
 *
 * `remote_id` is unique, so a retried connect attaches the same pair again
 * rather than creating a second link. Passing a different remote id for an
 * already-connected household is rejected instead of silently re-pointing it.
 */
export async function connectHouseholdToAccount(
  database: DatabaseConnection,
  id: string,
  remoteId: string,
): Promise<Household> {
  const existing = await getHousehold(database, id);
  if (!existing) throw new Error('Household not found.');
  if (existing.remoteId && existing.remoteId !== remoteId) {
    throw new Error('This library is already connected to a different account.');
  }
  if (existing.remoteId === remoteId) return existing;

  await database.runAsync(
    'UPDATE households SET remote_id = ?, is_local_only = 0, updated_at = ? WHERE id = ?;',
    remoteId,
    now(),
    id,
  );
  const household = await getHousehold(database, id);
  if (!household) throw new Error('Household could not be loaded.');
  return household;
}
