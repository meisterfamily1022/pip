import type { SyncEntity } from './conflict-resolution';
import { columnsFor, toColumns, toFieldName, toFields } from './record-columns';

const ENTITIES: SyncEntity[] = ['room', 'storage_spot', 'toy', 'child_profile', 'play_session'];

describe('record field and column translation', () => {
  it('sends the columns the backup schema actually declares', () => {
    expect(toColumns('storage_spot', { roomLocalId: 4, name: 'Blue Bin' }))
      .toEqual({ room_local_id: 4, name: 'Blue Bin' });

    expect(toColumns('play_session', { childLocalId: 2, toyLocalId: 9, status: 'active', startedAt: '2026-01-01' }))
      .toEqual({ child_local_id: 2, toy_local_id: 9, status: 'active', started_at: '2026-01-01' });
  });

  it('reads a Postgres row back into the fields the restore actually looks for', () => {
    // Exactly the shape fetchChangesSince gets from PostgREST.
    const row = {
      local_id: 7, revision: 12, deleted_at: null, household_id: 'abc',
      name: 'Tiles', room_local_id: 3, storage_spot_local_id: 5,
      cleanup_difficulty: 'medium', adult_help_required: true, categories: ['building'],
      image_path: 'household/7-1.jpg',
    };
    expect(toFields('toy', row)).toEqual({
      name: 'Tiles', roomLocalId: 3, storageSpotLocalId: 5,
      cleanupDifficulty: 'medium', adultHelpRequired: true, categories: ['building'],
      imagePath: 'household/7-1.jpg',
    });
  });

  it('drops bookkeeping columns rather than feeding them back as record fields', () => {
    const fields = toFields('room', { local_id: 1, revision: 4, household_id: 'x', deleted_at: null, name: 'Playroom' });
    expect(fields).toEqual({ name: 'Playroom' });
  });

  it('never sends this device\'s local file path to the server', () => {
    // image_uri is where the photo lives on *this* iPhone; image_path is the
    // object key. Storing the former remotely would be unresolvable anywhere else.
    const body = toColumns('toy', { name: 'Tiles', imageUri: 'file:///var/mobile/tiles.jpg', imagePath: 'h/7.jpg' });
    expect(body).toEqual({ name: 'Tiles', image_path: 'h/7.jpg' });
    expect(Object.keys(body)).not.toContain('image_uri');
  });

  it('drops an unknown field instead of failing the whole write on it', () => {
    expect(toColumns('room', { name: 'Playroom', somethingNew: true })).toEqual({ name: 'Playroom' });
  });

  it.each(ENTITIES)('round-trips every declared column of %s', (entity) => {
    const row = Object.fromEntries(columnsFor(entity).map((column, index) => [column, index]));
    expect(toColumns(entity, toFields(entity, row))).toEqual(row);
  });

  it('converts names symmetrically', () => {
    for (const column of ENTITIES.flatMap((entity) => [...columnsFor(entity)])) {
      expect(toFieldName(column).replace(/[A-Z]/g, (l) => `_${l.toLowerCase()}`)).toBe(column);
    }
  });
});
