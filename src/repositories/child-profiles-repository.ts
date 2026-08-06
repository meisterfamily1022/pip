import type { DatabaseConnection } from '@/database/types';
import type { ChildProfileRow } from '@/database/rows';
import type { ChildProfile, ChoiceLimit } from '@/domain/models';
import { LOCAL_HOUSEHOLD_ID } from '@/database/migrations';
import {
  DEFAULT_ACCENT_COLOR_ID,
  DEFAULT_AVATAR_ID,
  DEFAULT_CHOICE_COUNT,
  DEFAULT_READING_SUPPORT,
  isChoiceCount,
} from '@/domain/child-avatars';

const now = (): string => new Date().toISOString();

const COLUMNS =
  'id, household_id, name, avatar_id, accent_color_id, age_range, choice_limit, reading_support, display_order, hidden_at, created_at, updated_at';

function toProfile(row: ChildProfileRow): ChildProfile {
  return {
    id: row.id,
    householdId: row.household_id,
    name: row.name,
    avatarId: row.avatar_id,
    accentColorId: row.accent_color_id,
    ageRange: row.age_range,
    // A stored value outside the supported set would break Child Mode's layout,
    // so fall back rather than propagate it.
    choiceLimit: isChoiceCount(row.choice_limit) ? (row.choice_limit as ChoiceLimit) : DEFAULT_CHOICE_COUNT,
    readingSupport: row.reading_support,
    displayOrder: row.display_order,
    hiddenAt: row.hidden_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export type ChildProfileInput = {
  name: string;
  avatarId?: string;
  accentColorId?: string;
  ageRange?: string | null;
  choiceLimit?: ChoiceLimit;
  readingSupport?: string;
};

function validateName(name: string): string {
  const trimmed = name.trim();
  if (trimmed.length < 2) throw new Error('Child name must be at least 2 characters.');
  return trimmed;
}

/**
 * Profiles in the parent's chosen order. Hidden profiles are excluded unless
 * asked for, so Child Mode does not offer a profile the parent paused.
 */
export async function listChildProfiles(
  database: DatabaseConnection,
  options: { includeHidden?: boolean; householdId?: string } = {},
): Promise<ChildProfile[]> {
  const householdId = options.householdId ?? LOCAL_HOUSEHOLD_ID;
  const hiddenClause = options.includeHidden ? '' : 'AND hidden_at IS NULL';
  const rows = await database.getAllAsync<ChildProfileRow>(
    `SELECT ${COLUMNS} FROM child_profiles WHERE household_id = ? ${hiddenClause} ORDER BY display_order, id;`,
    householdId,
  );
  return rows.map(toProfile);
}

export async function getChildProfile(database: DatabaseConnection, id: number): Promise<ChildProfile | null> {
  const row = await database.getFirstAsync<ChildProfileRow>(`SELECT ${COLUMNS} FROM child_profiles WHERE id = ?;`, id);
  return row ? toProfile(row) : null;
}

export async function createChildProfile(
  database: DatabaseConnection,
  input: ChildProfileInput | string,
  householdId: string = LOCAL_HOUSEHOLD_ID,
): Promise<ChildProfile> {
  // The original signature took a bare name; both forms are accepted so callers
  // that only set a nickname keep working.
  const details: ChildProfileInput = typeof input === 'string' ? { name: input } : input;
  const name = validateName(details.name);
  const timestamp = now();

  const nextOrder = await database.getFirstAsync<{ next: number }>(
    'SELECT COALESCE(MAX(display_order), 0) + 1 AS next FROM child_profiles WHERE household_id = ?;',
    householdId,
  );

  const result = await database.runAsync(
    `INSERT INTO child_profiles
       (name, household_id, avatar_id, accent_color_id, age_range, choice_limit, reading_support, display_order, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
    name,
    householdId,
    details.avatarId ?? DEFAULT_AVATAR_ID,
    details.accentColorId ?? DEFAULT_ACCENT_COLOR_ID,
    details.ageRange ?? null,
    details.choiceLimit ?? DEFAULT_CHOICE_COUNT,
    details.readingSupport ?? DEFAULT_READING_SUPPORT,
    nextOrder?.next ?? 1,
    timestamp,
    timestamp,
  );

  const profile = await getChildProfile(database, result.lastInsertRowId);
  if (!profile) throw new Error('Child profile could not be loaded.');
  return profile;
}

export async function updateChildProfile(
  database: DatabaseConnection,
  id: number,
  input: Partial<ChildProfileInput> | string,
): Promise<ChildProfile> {
  const details: Partial<ChildProfileInput> = typeof input === 'string' ? { name: input } : input;
  const existing = await getChildProfile(database, id);
  if (!existing) throw new Error('Child profile not found.');

  const next = {
    name: details.name === undefined ? existing.name : validateName(details.name),
    avatarId: details.avatarId ?? existing.avatarId,
    accentColorId: details.accentColorId ?? existing.accentColorId,
    ageRange: details.ageRange === undefined ? existing.ageRange : details.ageRange,
    choiceLimit: details.choiceLimit ?? existing.choiceLimit,
    readingSupport: details.readingSupport ?? existing.readingSupport,
  };

  await database.runAsync(
    `UPDATE child_profiles
        SET name = ?, avatar_id = ?, accent_color_id = ?, age_range = ?, choice_limit = ?, reading_support = ?, updated_at = ?
      WHERE id = ?;`,
    next.name,
    next.avatarId,
    next.accentColorId,
    next.ageRange,
    next.choiceLimit,
    next.readingSupport,
    now(),
    id,
  );

  const profile = await getChildProfile(database, id);
  if (!profile) throw new Error('Child profile could not be loaded.');
  return profile;
}

/** Pauses a profile without deleting it or its history. */
export async function setChildProfileHidden(
  database: DatabaseConnection,
  id: number,
  hidden: boolean,
): Promise<ChildProfile> {
  const result = await database.runAsync(
    'UPDATE child_profiles SET hidden_at = ?, updated_at = ? WHERE id = ?;',
    hidden ? now() : null,
    now(),
    id,
  );
  if (result.changes !== 1) throw new Error('Child profile not found.');
  const profile = await getChildProfile(database, id);
  if (!profile) throw new Error('Child profile could not be loaded.');
  return profile;
}

/**
 * Rewrites display order from the given sequence.
 *
 * Applied in one transaction so a rapid double-tap or a retry cannot leave two
 * profiles claiming the same position.
 */
export async function reorderChildProfiles(database: DatabaseConnection, orderedIds: readonly number[]): Promise<void> {
  const timestamp = now();
  await database.withTransactionAsync(async () => {
    for (const [index, id] of orderedIds.entries()) {
      await database.runAsync(
        'UPDATE child_profiles SET display_order = ?, updated_at = ? WHERE id = ?;',
        index + 1,
        timestamp,
        id,
      );
    }
  });
}

export async function getActiveChildProfile(database: DatabaseConnection): Promise<ChildProfile> {
  const row = await database.getFirstAsync<ChildProfileRow>(
    `SELECT ${COLUMNS.split(', ')
      .map((column) => `c.${column}`)
      .join(', ')}
       FROM child_profiles c JOIN settings s ON s.active_child_id = c.id WHERE s.id = 1;`,
  );
  if (!row) throw new Error('Choose a child before opening Child Mode.');
  return toProfile(row);
}
