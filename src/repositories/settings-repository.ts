import type { AppSettings, ChoiceLimit } from '@/domain/models';
import type { SettingsRow } from '@/database/rows';
import type { DatabaseConnection } from '@/database/types';

const now = (): string => new Date().toISOString();
const isChoiceLimit = (value: number): value is ChoiceLimit => value === 1 || value === 3 || value === 5;

function toSettings(row: SettingsRow): AppSettings {
  if (!isChoiceLimit(row.choice_limit)) throw new Error('Stored choice limit is invalid.');
  return { onboardingCompleted: row.onboarding_completed === 1, childModeUsed: row.child_mode_used === 1, childNickname: row.child_nickname, activeChildId: row.active_child_id ?? null, choiceLimit: row.choice_limit, cleanupRequired: row.cleanup_required === 1, createdAt: row.created_at, updatedAt: row.updated_at };
}

export async function getSettings(database: DatabaseConnection): Promise<AppSettings> {
  const row = await database.getFirstAsync<SettingsRow>('SELECT onboarding_completed, child_mode_used, child_nickname, active_child_id, choice_limit, cleanup_required, created_at, updated_at FROM settings WHERE id = ?;', 1);
  if (!row) throw new Error('App settings have not been initialized.');
  return toSettings(row);
}

export async function ensureSettings(database: DatabaseConnection): Promise<AppSettings> {
  const timestamp = now();
  await database.runAsync('INSERT OR IGNORE INTO settings (id, created_at, updated_at) VALUES (?, ?, ?);', 1, timestamp, timestamp);
  return getSettings(database);
}

export type SettingsUpdate = Partial<Pick<AppSettings, 'onboardingCompleted' | 'childModeUsed' | 'childNickname' | 'activeChildId' | 'choiceLimit' | 'cleanupRequired'>>;

export async function updateSettings(database: DatabaseConnection, update: SettingsUpdate): Promise<AppSettings> {
  const existing = await getSettings(database);
  const next = { ...existing, ...update };
  await database.runAsync(
    'UPDATE settings SET onboarding_completed = ?, child_mode_used = ?, child_nickname = ?, active_child_id = ?, choice_limit = ?, cleanup_required = ?, updated_at = ? WHERE id = ?;',
    next.onboardingCompleted ? 1 : 0, next.childModeUsed ? 1 : 0, next.childNickname, next.activeChildId, next.choiceLimit, next.cleanupRequired ? 1 : 0, now(), 1,
  );
  return getSettings(database);
}

export async function markChildModeUsed(database: DatabaseConnection): Promise<AppSettings> {
  return updateSettings(database, { childModeUsed: true });
}

/**
 * Enters Guest play by recording no active child.
 *
 * A visitor leaves no permanent profile behind, and only toys shared with
 * everyone are offered to them.
 */
export async function clearActiveChild(database: DatabaseConnection): Promise<AppSettings> {
  return updateSettings(database, { activeChildId: null });
}

export async function setActiveChild(database: DatabaseConnection, childId: number): Promise<AppSettings> {
  const child = await database.getFirstAsync<{ id: number }>('SELECT id FROM child_profiles WHERE id = ?;', childId);
  if (!child) throw new Error('Choose a valid child profile.');
  return updateSettings(database, { activeChildId: childId });
}
