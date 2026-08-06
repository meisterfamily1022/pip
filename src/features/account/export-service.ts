import { LOCAL_HOUSEHOLD_ID } from '@/database/migrations';
import type { DatabaseConnection } from '@/database/types';

/**
 * Exports a household's data in a documented, readable format.
 *
 * Pip is local-first, so the export is built from the device database — the
 * copy that actually holds the family's library. It is deliberately plain JSON
 * rather than a database dump, so a parent can open it, read it, and move it
 * somewhere else without Pip.
 *
 * **Nothing secret is exported.** No password hash, no session token, no
 * verification code, no PIN. Photos are referenced by their on-device path
 * rather than embedded, because a family library can be hundreds of megabytes
 * and a JSON file full of base64 helps nobody.
 */

export const EXPORT_FORMAT_VERSION = 1;

export type ExportedHousehold = {
  formatVersion: number;
  exportedAt: string;
  household: { id: string; name: string };
  rooms: { id: number; name: string; storageSpots: { id: number; name: string }[] }[];
  toys: {
    id: number;
    name: string;
    room: string;
    storageSpot: string;
    categories: string[];
    photoPath: string | null;
    isAvailable: boolean;
    isArchived: boolean;
    availability: string;
    isSample: boolean;
  }[];
  children: {
    id: number;
    name: string;
    avatar: string;
    accentColor: string;
    ageRange: string | null;
    choiceLimit: number;
    readingSupport: string;
    hidden: boolean;
  }[];
  playHistory: { toy: string; child: string | null; startedAt: string; completedAt: string | null }[];
};

export type ExportClock = { now(): Date };

/**
 * Builds the export.
 *
 * Names are resolved rather than left as foreign keys, so the file makes sense
 * to a person reading it without the schema in front of them.
 */
export async function buildHouseholdExport(
  database: DatabaseConnection,
  householdId: string = LOCAL_HOUSEHOLD_ID,
  clock: ExportClock = { now: () => new Date() },
): Promise<ExportedHousehold> {
  const household = await database.getFirstAsync<{ id: string; name: string }>(
    'SELECT id, name FROM households WHERE id = ?;',
    householdId,
  );
  if (!household) throw new Error('There is nothing to export yet.');

  const roomRows = await database.getAllAsync<{ id: number; name: string }>(
    'SELECT id, name FROM rooms WHERE household_id = ? ORDER BY name COLLATE NOCASE;',
    householdId,
  );
  const spotRows = await database.getAllAsync<{ id: number; room_id: number; name: string }>(
    'SELECT id, room_id, name FROM storage_spots WHERE household_id = ? ORDER BY name COLLATE NOCASE;',
    householdId,
  );

  const toyRows = await database.getAllAsync<{
    id: number;
    name: string;
    room_name: string;
    spot_name: string;
    image_uri: string | null;
    is_available: number;
    is_archived: number;
    availability_scope: string;
    is_sample: number;
  }>(
    `SELECT t.id, t.name, r.name AS room_name, s.name AS spot_name, t.image_uri,
            t.is_available, t.is_archived, t.availability_scope, t.is_sample
       FROM toys t
       JOIN rooms r ON r.id = t.room_id
       JOIN storage_spots s ON s.id = t.storage_spot_id
      WHERE t.household_id = ?
      ORDER BY t.name COLLATE NOCASE;`,
    householdId,
  );

  const categoryRows = await database.getAllAsync<{ toy_id: number; category: string }>(
    'SELECT toy_id, category FROM toy_categories ORDER BY category;',
  );
  const categoriesByToy = new Map<number, string[]>();
  for (const row of categoryRows) {
    categoriesByToy.set(row.toy_id, [...(categoriesByToy.get(row.toy_id) ?? []), row.category]);
  }

  const childRows = await database.getAllAsync<{
    id: number;
    name: string;
    avatar_id: string;
    accent_color_id: string;
    age_range: string | null;
    choice_limit: number;
    reading_support: string;
    hidden_at: string | null;
  }>(
    `SELECT id, name, avatar_id, accent_color_id, age_range, choice_limit, reading_support, hidden_at
       FROM child_profiles WHERE household_id = ? ORDER BY display_order, id;`,
    householdId,
  );

  const historyRows = await database.getAllAsync<{
    toy_name: string;
    child_name: string | null;
    started_at: string;
    completed_at: string | null;
  }>(
    `SELECT t.name AS toy_name, c.name AS child_name, p.started_at, p.completed_at
       FROM play_sessions p
       JOIN toys t ON t.id = p.toy_id
       LEFT JOIN child_profiles c ON c.id = p.child_id
      WHERE p.household_id = ?
      ORDER BY p.started_at;`,
    householdId,
  );

  return {
    formatVersion: EXPORT_FORMAT_VERSION,
    exportedAt: clock.now().toISOString(),
    household: { id: household.id, name: household.name },
    rooms: roomRows.map((room) => ({
      id: room.id,
      name: room.name,
      storageSpots: spotRows.filter((spot) => spot.room_id === room.id).map((spot) => ({ id: spot.id, name: spot.name })),
    })),
    toys: toyRows.map((toy) => ({
      id: toy.id,
      name: toy.name,
      room: toy.room_name,
      storageSpot: toy.spot_name,
      categories: categoriesByToy.get(toy.id) ?? [],
      // A path, not the image. The photo stays where it already is.
      photoPath: toy.image_uri,
      isAvailable: toy.is_available === 1,
      isArchived: toy.is_archived === 1,
      availability: toy.availability_scope,
      isSample: toy.is_sample === 1,
    })),
    children: childRows.map((child) => ({
      id: child.id,
      name: child.name,
      avatar: child.avatar_id,
      accentColor: child.accent_color_id,
      ageRange: child.age_range,
      choiceLimit: child.choice_limit,
      readingSupport: child.reading_support,
      hidden: child.hidden_at !== null,
    })),
    // Guest sessions export with a null child, matching how they are stored.
    playHistory: historyRows.map((row) => ({
      toy: row.toy_name,
      child: row.child_name,
      startedAt: row.started_at,
      completedAt: row.completed_at,
    })),
  };
}

/** Serialised for writing to a file or sharing. */
export function serialiseExport(data: ExportedHousehold): string {
  return JSON.stringify(data, null, 2);
}

/** Filename a parent will recognise months later. */
export function exportFileName(data: ExportedHousehold): string {
  return `pip-export-${data.exportedAt.slice(0, 10)}.json`;
}
