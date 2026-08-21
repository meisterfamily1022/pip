import type { SyncEntity } from './conflict-resolution';

/**
 * Translation between the sync service's record fields and the backup schema's
 * columns.
 *
 * The service works in camelCase (`roomLocalId`, `startedAt`) because that is
 * what `applyRestoredRows` reads and what `FakeHouseholdGateway` echoes back.
 * Postgres works in snake_case (`room_local_id`, `started_at`). While the only
 * gateway in play was the fake, which returns whatever it was handed, the two
 * never had to agree and the mismatch was invisible: every test passed and the
 * real transport could not have worked in either direction. A push would have
 * sent columns the table does not have, and a restore would have read fields
 * the row does not carry — `Number(undefined)` is `NaN`, so every storage spot,
 * toy and play session would have failed its insert and been reported as an
 * unexplained skip.
 *
 * Kept here, pure and separate from supabase-js, so the mapping is testable
 * without a network and so both directions are provably each other's inverse.
 */

/**
 * The columns each entity actually has. An allowlist rather than a blanket
 * conversion: a stray field would otherwise reach PostgREST as an unknown
 * column and fail the whole write.
 *
 * `image_uri` is deliberately absent from `toy`. It is this device's local file
 * path; the remote row holds `image_path`, the object's key in the bucket.
 * Sending a local path to the server would store something no other device
 * could ever resolve.
 */
const COLUMNS: Record<SyncEntity, readonly string[]> = {
  room: ['name'],
  storage_spot: ['room_local_id', 'name'],
  toy: [
    'name', 'room_local_id', 'storage_spot_local_id', 'cleanup_difficulty', 'adult_help_required',
    'is_available', 'is_archived', 'availability_scope', 'categories', 'image_path', 'image_uploaded_at',
  ],
  child_profile: [
    'name', 'avatar_id', 'accent_color_id', 'age_range', 'choice_limit', 'reading_support',
    'display_order', 'hidden_at',
  ],
  play_session: ['child_local_id', 'toy_local_id', 'status', 'started_at', 'completed_at', 'interrupted_at'],
};

export const toColumnName = (field: string): string => field.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);
export const toFieldName = (column: string): string => column.replace(/_([a-z])/g, (_, letter: string) => letter.toUpperCase());

/** Record fields → a row body for the backup schema. Unknown fields are dropped. */
export function toColumns(entity: SyncEntity, data: Record<string, unknown>): Record<string, unknown> {
  const allowed = new Set(COLUMNS[entity]);
  const body: Record<string, unknown> = {};
  for (const [field, value] of Object.entries(data)) {
    const column = toColumnName(field);
    if (allowed.has(column)) body[column] = value;
  }
  return body;
}

/** A row from the backup schema → the record fields the sync service reads. */
export function toFields(entity: SyncEntity, row: Record<string, unknown>): Record<string, unknown> {
  const allowed = new Set(COLUMNS[entity]);
  const fields: Record<string, unknown> = {};
  for (const [column, value] of Object.entries(row)) {
    if (allowed.has(column)) fields[toFieldName(column)] = value;
  }
  return fields;
}

/** The columns of one entity, for a gateway that wants to select them explicitly. */
export const columnsFor = (entity: SyncEntity): readonly string[] => COLUMNS[entity];
