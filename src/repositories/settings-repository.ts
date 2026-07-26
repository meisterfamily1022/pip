import type { AppSettings, ChoiceLimit } from '@/domain/models';
import type { SettingsRow } from '@/database/rows';
import type { DatabaseConnection } from '@/database/types';

const now = (): string => new Date().toISOString();
const isChoiceLimit = (value: number): value is ChoiceLimit => value === 1 || value === 3 || value === 5;

function toSettings(row: SettingsRow): AppSettings {
  if (!isChoiceLimit(row.choice_limit)) throw new Error('Stored choice limit is invalid.');
  return { onboardingCompleted: row.onboarding_completed === 1, childNickname: row.child_nickname, choiceLimit: row.choice_limit, cleanupRequired: row.cleanup_required === 1, createdAt: row.created_at, updatedAt: row.updated_at };
}

export async function getSettings(database: DatabaseConnection): Promise<AppSettings> {
  const row = await database.getFirstAsync<SettingsRow>('SELECT onboarding_completed, child_nickname, choice_limit, cleanup_required, created_at, updated_at FROM settings WHERE id = ?;', 1);
  if (!row) throw new Error('App settings have not been initialized.');
  return toSettings(row);
}

export async function ensureSettings(database: DatabaseConnection): Promise<AppSettings> {
  const timestamp = now();
  await database.runAsync('INSERT OR IGNORE INTO settings (id, created_at, updated_at) VALUES (?, ?, ?);', 1, timestamp, timestamp);
  return getSettings(database);
}

export type SettingsUpdate = Partial<Pick<AppSettings, 'onboardingCompleted' | 'childNickname' | 'choiceLimit' | 'cleanupRequired'>>;

export async function updateSettings(database: DatabaseConnection, update: SettingsUpdate): Promise<AppSettings> {
  const existing = await getSettings(database);
  const next = { ...existing, ...update };
  await database.runAsync(
    'UPDATE settings SET onboarding_completed = ?, child_nickname = ?, choice_limit = ?, cleanup_required = ?, updated_at = ? WHERE id = ?;',
    next.onboardingCompleted ? 1 : 0, next.childNickname, next.choiceLimit, next.cleanupRequired ? 1 : 0, now(), 1,
  );
  return getSettings(database);
}
