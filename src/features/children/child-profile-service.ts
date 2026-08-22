import { LOCAL_HOUSEHOLD_ID } from '@/database/migrations';
import type { DatabaseConnection } from '@/database/types';
import type { ChildProfile, ChoiceLimit } from '@/domain/models';
import { normalizeChildName } from '@/domain/child-name';
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

const now = (): string => new Date().toISOString();

/**
 * The same rule the stored `normalized_name` column is written from, so this
 * pre-check and the database's unique index can never disagree about whether
 * two names are the same name.
 */
const nameKey = normalizeChildName;

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

/** A violation of the per-household unique name index. */
function isNameClash(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return message.includes('child_profile_normalized_name_per_household');
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
  try {
    return await createChildProfile(database, { ...details, name } as ChildProfileInput, householdId);
  } catch (error) {
    // Two taps landing together both pass the check above; the unique index
    // stops the second insert. Report it as the same clash a parent would
    // have seen had the first tap finished first.
    if (isNameClash(error)) throw new ChildProfileError('There is already a profile with that name.');
    throw error;
  }
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

/**
 * What happens to the play records a deleted profile leaves behind.
 *
 * Two different families want two different things, and neither is obviously
 * right, so the parent chooses rather than the code deciding for them:
 *
 * - `delete` removes the records. Everything Pip remembered about that child is
 *   gone, which is what somebody removing a profile for privacy reasons means.
 * - `anonymise` keeps them and detaches them from the child. The household
 *   still knows this toy was played with on that day, which is what somebody
 *   tidying up an outgrown profile means, and no record of *who* survives.
 *
 * Either way, inventory is untouched. That is not a choice.
 */
export type ChildHistoryDisposition = 'delete' | 'anonymise';

export type ChildDeletionSummary = {
  /** Play sessions removed with the profile. */
  removedSessions: number;
  /** Play sessions kept, with the child detached. */
  anonymisedSessions: number;
};

/**
 * Removes a profile, doing what the parent asked with its play history.
 *
 * Household inventory is deliberately untouched. `play_sessions.child_id` is
 * RESTRICT, so the history must be dealt with before the profile row goes,
 * whichever disposition was chosen.
 *
 * A session still open is completed rather than left active. A child who no
 * longer exists cannot still be mid-play, and an anonymised active session
 * would collide with the household's one Guest slot — so ending it is both the
 * truthful answer and the one the schema permits.
 *
 * If the deleted profile was the active one, the pointer is cleared so Child
 * Mode asks who is playing rather than opening a profile that is gone.
 */
export async function deleteChildProfile(
  database: DatabaseConnection,
  id: number,
  history: ChildHistoryDisposition = 'delete',
): Promise<ChildDeletionSummary> {
  const existing = await getChildProfile(database, id);
  if (!existing) throw new ChildProfileError('That profile no longer exists.');

  let removedSessions = 0;
  let anonymisedSessions = 0;

  await database.withTransactionAsync(async () => {
    if (history === 'delete') {
      const sessions = await database.runAsync('DELETE FROM play_sessions WHERE child_id = ?;', id);
      removedSessions = sessions.changes;
    } else {
      await database.runAsync(
        `UPDATE play_sessions
            SET status = 'completed', completed_at = COALESCE(completed_at, ?), updated_at = ?
          WHERE child_id = ? AND status = 'active';`,
        now(),
        now(),
        id,
      );
      const kept = await database.runAsync(
        'UPDATE play_sessions SET child_id = NULL, updated_at = ? WHERE child_id = ?;',
        now(),
        id,
      );
      anonymisedSessions = kept.changes;
    }

    await database.runAsync('UPDATE settings SET active_child_id = NULL WHERE active_child_id = ?;', id);
    const result = await database.runAsync('DELETE FROM child_profiles WHERE id = ?;', id);
    if (result.changes !== 1) throw new ChildProfileError('That profile no longer exists.');
  });

  return { removedSessions, anonymisedSessions };
}

/** What each disposition will actually do, for the confirmation screen. */
export function describeHistoryDisposition(disposition: ChildHistoryDisposition, sessions: number): string {
  const records = sessions === 1 ? '1 play record' : `${sessions} play records`;
  if (sessions === 0) return 'This profile has no play history yet.';
  return disposition === 'delete'
    ? `${records} will be deleted.`
    : `${records} will be kept for the household, with this child's name removed.`;
}

/** How many play records a profile currently has, so the choice is informed. */
export async function countChildHistory(database: DatabaseConnection, id: number): Promise<number> {
  const row = await database.getFirstAsync<{ count: number }>(
    'SELECT COUNT(*) AS count FROM play_sessions WHERE child_id = ?;',
    id,
  );
  return row?.count ?? 0;
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
