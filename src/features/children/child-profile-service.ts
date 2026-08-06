import { LOCAL_HOUSEHOLD_ID } from '@/database/migrations';
import type { DatabaseConnection } from '@/database/types';
import type { ChildProfile, ChoiceLimit } from '@/domain/models';
import {
  createChildProfile,
  getChildProfile,
  listChildProfiles,
  reorderChildProfiles,
  setChildProfileHidden,
  updateChildProfile,
  type ChildProfileInput,
} from '@/repositories/child-profiles-repository';

/**
 * Parent-facing child profile management.
 *
 * Profiles are optional. A household may have none, one, or several, and Child
 * Mode works either way.
 *
 * The rule that shapes everything here: **a child profile owns preferences and
 * play history, never inventory.** Toys, rooms, storage spots, photos and
 * categories belong to the household, so removing a profile must never remove
 * any of them.
 */

export class ChildProfileError extends Error {}

const MINIMUM_NAME_LENGTH = 2;

/**
 * Names are compared case- and space-insensitively.
 *
 * Without this, a double tap or a replayed offline queue produces "Sam" twice
 * and the parent cannot tell the profiles apart.
 */
const nameKey = (name: string): string => name.trim().toLowerCase().replace(/\s+/g, ' ');

async function assertNameAvailable(
  database: DatabaseConnection,
  name: string,
  householdId: string,
  excludingId?: number,
): Promise<void> {
  const existing = await listChildProfiles(database, { includeHidden: true, householdId });
  const clash = existing.some((profile) => profile.id !== excludingId && nameKey(profile.name) === nameKey(name));
  if (clash) throw new ChildProfileError('There is already a profile with that name.');
}

export type ChildProfileDetails = {
  name: string;
  avatarId?: string;
  accentColorId?: string;
  ageRange?: string | null;
  choiceLimit?: ChoiceLimit;
  readingSupport?: string;
};

export function loadChildProfiles(
  database: DatabaseConnection,
  options: { includeHidden?: boolean; householdId?: string } = {},
): Promise<ChildProfile[]> {
  return listChildProfiles(database, options);
}

export function loadChildProfile(database: DatabaseConnection, id: number): Promise<ChildProfile | null> {
  return getChildProfile(database, id);
}

export async function addChildProfile(
  database: DatabaseConnection,
  details: ChildProfileDetails,
  householdId: string = LOCAL_HOUSEHOLD_ID,
): Promise<ChildProfile> {
  const name = details.name.trim();
  if (name.length < MINIMUM_NAME_LENGTH) {
    throw new ChildProfileError(`Use at least ${MINIMUM_NAME_LENGTH} characters for a name.`);
  }
  await assertNameAvailable(database, name, householdId);
  return createChildProfile(database, { ...details, name } as ChildProfileInput, householdId);
}

export async function saveChildProfile(
  database: DatabaseConnection,
  id: number,
  details: Partial<ChildProfileDetails>,
): Promise<ChildProfile> {
  const existing = await getChildProfile(database, id);
  if (!existing) throw new ChildProfileError('That profile no longer exists.');

  if (details.name !== undefined) {
    const name = details.name.trim();
    if (name.length < MINIMUM_NAME_LENGTH) {
      throw new ChildProfileError(`Use at least ${MINIMUM_NAME_LENGTH} characters for a name.`);
    }
    await assertNameAvailable(database, name, existing.householdId, id);
  }

  return updateChildProfile(database, id, details as Partial<ChildProfileInput>);
}

/** Pauses a profile. Its history and preferences are kept. */
export function setChildHidden(database: DatabaseConnection, id: number, hidden: boolean): Promise<ChildProfile> {
  return setChildProfileHidden(database, id, hidden);
}

/**
 * Applies a new order.
 *
 * Ignores ids that are not in the household so a stale list from another screen
 * cannot reassign someone else's profiles, and writes in one transaction so a
 * retry cannot leave two profiles sharing a position.
 */
export async function reorderChildren(
  database: DatabaseConnection,
  orderedIds: readonly number[],
  householdId: string = LOCAL_HOUSEHOLD_ID,
): Promise<ChildProfile[]> {
  const existing = await listChildProfiles(database, { includeHidden: true, householdId });
  const known = new Set(existing.map((profile) => profile.id));
  const filtered = orderedIds.filter((id) => known.has(id));
  // Anything the caller omitted keeps its relative position at the end, so a
  // partial list cannot silently drop a profile from the ordering.
  const remainder = existing.filter((profile) => !filtered.includes(profile.id)).map((profile) => profile.id);

  await reorderChildProfiles(database, [...filtered, ...remainder]);
  return listChildProfiles(database, { includeHidden: true, householdId });
}

export type ChildDeletionSummary = {
  /** Play sessions removed with the profile. */
  removedSessions: number;
};

/**
 * Removes a profile and its play history.
 *
 * Household inventory is deliberately untouched. `play_sessions.child_id` is
 * RESTRICT, so the history has to go first or the delete is rejected; that is
 * also the privacy-respecting choice, since the history is the only part that
 * is about the child rather than about the household.
 *
 * If the deleted profile was the active one, the pointer is cleared so Child
 * Mode asks who is playing rather than opening a profile that no longer exists.
 */
export async function deleteChildProfile(
  database: DatabaseConnection,
  id: number,
): Promise<ChildDeletionSummary> {
  const existing = await getChildProfile(database, id);
  if (!existing) throw new ChildProfileError('That profile no longer exists.');

  let removedSessions = 0;
  await database.withTransactionAsync(async () => {
    const sessions = await database.runAsync('DELETE FROM play_sessions WHERE child_id = ?;', id);
    removedSessions = sessions.changes;
    await database.runAsync('UPDATE settings SET active_child_id = NULL WHERE active_child_id = ?;', id);
    const result = await database.runAsync('DELETE FROM child_profiles WHERE id = ?;', id);
    if (result.changes !== 1) throw new ChildProfileError('That profile no longer exists.');
  });

  return { removedSessions };
}

/**
 * Clears a profile's play history without removing the profile.
 *
 * Offered separately from deletion so a parent can reset what Pip remembers
 * about a child while keeping their preferences.
 */
export async function clearChildHistory(database: DatabaseConnection, id: number): Promise<number> {
  const existing = await getChildProfile(database, id);
  if (!existing) throw new ChildProfileError('That profile no longer exists.');
  const result = await database.runAsync("DELETE FROM play_sessions WHERE child_id = ? AND status = 'completed';", id);
  return result.changes;
}
