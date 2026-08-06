import type { DatabaseConnection } from '@/database/types';
import type { ChildProfileRow } from '@/database/rows';
import type { ChildProfile } from '@/domain/models';

const now = (): string => new Date().toISOString();
const toProfile = (row: ChildProfileRow): ChildProfile => ({ id: row.id, name: row.name, createdAt: row.created_at, updatedAt: row.updated_at });

export async function listChildProfiles(database: DatabaseConnection): Promise<ChildProfile[]> {
  const rows = await database.getAllAsync<ChildProfileRow>('SELECT id, name, created_at, updated_at FROM child_profiles ORDER BY created_at, id;');
  return rows.map(toProfile);
}

export async function getChildProfile(database: DatabaseConnection, id: number): Promise<ChildProfile | null> {
  const row = await database.getFirstAsync<ChildProfileRow>('SELECT id, name, created_at, updated_at FROM child_profiles WHERE id = ?;', id);
  return row ? toProfile(row) : null;
}

export async function createChildProfile(database: DatabaseConnection, name: string): Promise<ChildProfile> {
  const trimmed = name.trim();
  if (trimmed.length < 2) throw new Error('Child name must be at least 2 characters.');
  const timestamp = now();
  const result = await database.runAsync('INSERT INTO child_profiles (name, created_at, updated_at) VALUES (?, ?, ?);', trimmed, timestamp, timestamp);
  const profile = await getChildProfile(database, result.lastInsertRowId);
  if (!profile) throw new Error('Child profile could not be loaded.');
  return profile;
}

export async function updateChildProfile(database: DatabaseConnection, id: number, name: string): Promise<ChildProfile> {
  const trimmed = name.trim();
  if (trimmed.length < 2) throw new Error('Child name must be at least 2 characters.');
  const result = await database.runAsync('UPDATE child_profiles SET name = ?, updated_at = ? WHERE id = ?;', trimmed, now(), id);
  if (result.changes !== 1) throw new Error('Child profile not found.');
  const profile = await getChildProfile(database, id);
  if (!profile) throw new Error('Child profile could not be loaded.');
  return profile;
}

export async function getActiveChildProfile(database: DatabaseConnection): Promise<ChildProfile> {
  const row = await database.getFirstAsync<ChildProfileRow>(`SELECT c.id, c.name, c.created_at, c.updated_at FROM child_profiles c JOIN settings s ON s.active_child_id = c.id WHERE s.id = 1;`);
  if (!row) throw new Error('Choose a child before opening Child Mode.');
  return toProfile(row);
}
