import type { DatabaseConnection, SqlParameters, SqlRunResult } from '@/database/types';
import type { PlayCategory } from '@/domain/play-category';
import { createToy, deleteToy, listParentToys, setToyArchived, setToyAvailable, updateToy } from '@/repositories/toys-repository';
import { createParentToy, permanentlyDeleteParentToy, ToyValidationError, updateParentToy, type ToyFormInput } from './toy-service';
import type { ToyImageStorage } from './toy-image-storage';

type Row = Record<string, string | number | null>;

class ToyTestDatabase implements DatabaseConnection {
  private nextId = 0;
  public failToyCreate = false;
  public failCategoryInsert = false;
  public failToyDelete = false;
  public readonly rooms = new Map<number, Row>();
  public readonly spots = new Map<number, Row>();
  public readonly toys = new Map<number, Row>();
  public readonly categories = new Map<number, PlayCategory[]>();

  constructor() {
    this.seedRoom('Playroom', ['Blue Bin', 'Shelf']);
    this.seedRoom('Bedroom', ['Closet']);
  }

  private id(): number { this.nextId += 1; return this.nextId; }

  private seedRoom(name: string, spots: string[]): void {
    const id = this.id();
    this.rooms.set(id, { id, name, created_at: '', updated_at: '' });
    for (const spotName of spots) {
      const spotId = this.id();
      this.spots.set(spotId, { id: spotId, room_id: id, name: spotName, created_at: '', updated_at: '' });
    }
  }

  async execAsync(): Promise<void> {}

  async withTransactionAsync(task: () => Promise<void>): Promise<void> {
    const toys = new Map([...this.toys].map(([key, value]) => [key, { ...value }]));
    const categories = new Map([...this.categories].map(([key, value]) => [key, [...value]]));
    try {
      await task();
    } catch (error: unknown) {
      this.toys.clear(); toys.forEach((value, key) => this.toys.set(key, value));
      this.categories.clear(); categories.forEach((value, key) => this.categories.set(key, value));
      throw error;
    }
  }

  async runAsync(source: string, ...params: SqlParameters): Promise<SqlRunResult> {
    if (source.startsWith('INSERT INTO toys')) {
      if (this.failToyCreate) throw new Error('toy insert failed');
      const id = this.id();
      this.toys.set(id, { id, name: params[0]!, image_uri: params[1]!, room_id: params[2]!, storage_spot_id: params[3]!, cleanup_difficulty: params[4]!, adult_help_required: params[5]!, is_available: params[6]!, is_archived: params[7]!, created_at: params[8]!, updated_at: params[9]! });
      return { lastInsertRowId: id, changes: 1 };
    }
    if (source.startsWith('UPDATE toys SET name')) {
      const id = params[9] as number;
      const row = this.toys.get(id);
      if (!row) return { lastInsertRowId: 0, changes: 0 };
      row.name = params[0]!; row.image_uri = params[1]!; row.room_id = params[2]!; row.storage_spot_id = params[3]!; row.cleanup_difficulty = params[4]!; row.adult_help_required = params[5]!; row.is_available = params[6]!; row.is_archived = params[7]!; row.updated_at = params[8]!;
      return { lastInsertRowId: 0, changes: 1 };
    }
    if (source.startsWith('UPDATE toys SET is_archived')) {
      const row = this.toys.get(params[2] as number);
      if (!row) return { lastInsertRowId: 0, changes: 0 };
      row.is_archived = params[0]!;
      return { lastInsertRowId: 0, changes: 1 };
    }
    if (source.startsWith('UPDATE toys SET is_available')) {
      const row = this.toys.get(params[2] as number);
      if (!row) return { lastInsertRowId: 0, changes: 0 };
      row.is_available = params[0]!;
      return { lastInsertRowId: 0, changes: 1 };
    }
    if (source.startsWith('INSERT INTO toy_categories')) {
      if (this.failCategoryInsert) throw new Error('category insert failed');
      const toyId = params[0] as number;
      this.categories.set(toyId, [...(this.categories.get(toyId) ?? []), params[1] as PlayCategory]);
      return { lastInsertRowId: 0, changes: 1 };
    }
    if (source.startsWith('DELETE FROM toy_categories')) {
      this.categories.delete(params[0] as number);
      return { lastInsertRowId: 0, changes: 1 };
    }
    if (source.startsWith('DELETE FROM toys')) {
      if (this.failToyDelete) throw new Error('toy delete failed');
      const changes = this.toys.delete(params[0] as number) ? 1 : 0;
      return { lastInsertRowId: 0, changes };
    }
    throw new Error(`Unhandled SQL: ${source}`);
  }

  private joinedToy(row: Row): Row {
    const room = this.rooms.get(row.room_id as number)!;
    const spot = this.spots.get(row.storage_spot_id as number)!;
    return { ...row, room_name: room.name, storage_spot_name: spot.name };
  }

  async getFirstAsync<T>(source: string, ...params: SqlParameters): Promise<T | null> {
    if (source.includes('JOIN rooms') && source.includes('WHERE t.id')) {
      const row = this.toys.get(params[0] as number);
      return row ? this.joinedToy(row) as T : null;
    }
    if (source.includes('FROM rooms')) return (this.rooms.get(params[0] as number) ?? null) as T | null;
    if (source.includes('FROM storage_spots')) return (this.spots.get(params[0] as number) ?? null) as T | null;
    if (source.includes('FROM toys')) return (this.toys.get(params[0] as number) ?? null) as T | null;
    throw new Error(`Unhandled SQL: ${source}`);
  }

  async getAllAsync<T>(source: string, ...params: SqlParameters): Promise<T[]> {
    if (source.includes('FROM toys t')) {
      let rows = [...this.toys.values()];
      let index = 0;
      if (source.includes('t.is_archived = ?')) { const archived = params[index++]; rows = rows.filter((row) => row.is_archived === archived); }
      if (source.includes('t.is_available = ?')) { const available = params[index++]; rows = rows.filter((row) => row.is_available === available); }
      if (source.includes('t.room_id = ?')) { const roomId = params[index++]; rows = rows.filter((row) => row.room_id === roomId); }
      if (source.includes('t.name LIKE ?')) { const search = String(params[index++]).replace(/%/g, '').toLowerCase(); rows = rows.filter((row) => String(row.name).toLowerCase().includes(search)); }
      if (source.includes('tc.category = ?')) { const category = params[index++] as PlayCategory; rows = rows.filter((row) => (this.categories.get(row.id as number) ?? []).includes(category)); }
      return rows.map((row) => this.joinedToy(row) as T).sort((left, right) => String((left as Row).name).localeCompare(String((right as Row).name)));
    }
    if (source.includes('FROM toy_categories')) return (this.categories.get(params[0] as number) ?? []).sort().map((category) => ({ category }) as T);
    throw new Error(`Unhandled SQL: ${source}`);
  }
}

class TestImageStorage implements ToyImageStorage {
  public copied: string[] = [];
  public deleted: (string | null)[] = [];
  public failDelete = false;
  async copyIntoManagedStorage(sourceUri: string): Promise<string> {
    const uri = `file:///managed/${sourceUri.split('/').pop()}`;
    this.copied.push(uri);
    return uri;
  }
  async deleteManagedImage(uri: string | null): Promise<void> {
    this.deleted.push(uri);
    if (this.failDelete) throw new Error('delete failed');
  }
}

const validInput = (overrides: Partial<ToyFormInput> = {}): ToyFormInput => ({
  name: ' Blocks ',
  sourceImageUri: 'file:///source/blocks.jpg',
  roomId: 1,
  storageSpotId: 2,
  categories: ['building'],
  cleanupDifficulty: 'easy',
  adultHelpRequired: false,
  isAvailable: true,
  ...overrides,
});

describe('parent toy service validation', () => {
  it.each([
    ['required photo', { sourceImageUri: null }, 'Photo is required.'],
    ['required name', { name: '   ' }, 'Toy name is required.'],
    ['required room', { roomId: null }, 'Room is required.'],
    ['required storage spot', { storageSpotId: null }, 'Storage spot is required.'],
    ['storage spot belongs to room', { roomId: 4, storageSpotId: 2 }, 'Storage spot must belong to the selected room.'],
    ['required category', { categories: [] }, 'Choose at least one category.'],
  ])('validates %s', async (_name, overrides, message) => {
    await expect(createParentToy(new ToyTestDatabase(), validInput(overrides), new TestImageStorage())).rejects.toThrow(message);
    await expect(createParentToy(new ToyTestDatabase(), validInput(overrides), new TestImageStorage())).rejects.toBeInstanceOf(ToyValidationError);
  });

  it('trims names and creates with categories', async () => {
    const database = new ToyTestDatabase();
    const toy = await createParentToy(database, validInput({ categories: ['building', 'creative', 'building'] }), new TestImageStorage());
    expect(toy).toMatchObject({ name: 'Blocks', imageUri: 'file:///managed/blocks.jpg', categories: ['building', 'creative'] });
  });
});

describe('parent toy repository filters', () => {
  it('lists with location names, sorts alphabetically, and filters search, room, category, hidden, and archived', async () => {
    const database = new ToyTestDatabase();
    await createToy(database, { name: 'zebra', imageUri: 'file:///z.jpg', roomId: 1, storageSpotId: 2, cleanupDifficulty: 'easy', adultHelpRequired: false, isAvailable: true, isArchived: false, categories: ['active'] });
    await createToy(database, { name: 'Apple', imageUri: 'file:///a.jpg', roomId: 4, storageSpotId: 5, cleanupDifficulty: 'big', adultHelpRequired: true, isAvailable: false, isArchived: false, categories: ['quiet'] });
    await createToy(database, { name: 'Blocks', imageUri: 'file:///b.jpg', roomId: 1, storageSpotId: 3, cleanupDifficulty: 'medium', adultHelpRequired: false, isAvailable: true, isArchived: true, categories: ['building'] });
    await expect(listParentToys(database, { archived: 'all' })).resolves.toMatchObject([{ name: 'Apple', roomName: 'Bedroom', storageSpotName: 'Closet' }, { name: 'Blocks' }, { name: 'zebra' }]);
    await expect(listParentToys(database, { search: 'APP' })).resolves.toMatchObject([{ name: 'Apple' }]);
    await expect(listParentToys(database, { roomId: 1 })).resolves.toMatchObject([{ name: 'zebra' }]);
    await expect(listParentToys(database, { category: 'quiet' })).resolves.toMatchObject([{ name: 'Apple' }]);
    await expect(listParentToys(database, { availability: 'hidden' })).resolves.toMatchObject([{ name: 'Apple' }]);
    await expect(listParentToys(database, { archived: 'archived' })).resolves.toMatchObject([{ name: 'Blocks' }]);
  });
});

describe('parent toy mutation compensation', () => {
  it('removes a copied image when create fails', async () => {
    const database = new ToyTestDatabase();
    database.failToyCreate = true;
    const storage = new TestImageStorage();
    await expect(createParentToy(database, validInput(), storage)).rejects.toThrow('toy insert failed');
    expect(storage.deleted).toEqual(['file:///managed/blocks.jpg']);
  });

  it('rolls back atomic update, preserves old image, and removes new image when update fails', async () => {
    const database = new ToyTestDatabase();
    const storage = new TestImageStorage();
    const toy = await createParentToy(database, validInput(), storage);
    database.failCategoryInsert = true;
    await expect(updateParentToy(database, toy.id, validInput({ name: 'New Name', sourceImageUri: 'file:///source/new.jpg', existingImageUri: toy.imageUri }), storage)).rejects.toThrow('category insert failed');
    expect(database.toys.get(toy.id)?.name).toBe('Blocks');
    expect(storage.deleted).toContain('file:///managed/new.jpg');
    expect(storage.deleted).not.toContain('file:///managed/blocks.jpg');
  });

  it('deletes the old managed image after successful replacement', async () => {
    const database = new ToyTestDatabase();
    const storage = new TestImageStorage();
    const toy = await createParentToy(database, validInput(), storage);
    await updateParentToy(database, toy.id, validInput({ sourceImageUri: 'file:///source/new.jpg', existingImageUri: toy.imageUri }), storage);
    expect(storage.deleted).toContain('file:///managed/blocks.jpg');
  });

  it('archives, restores, toggles availability, and permanently deletes with image cleanup', async () => {
    const database = new ToyTestDatabase();
    const storage = new TestImageStorage();
    const toy = await createParentToy(database, validInput(), storage);
    await setToyArchived(database, toy.id, true);
    expect(database.toys.get(toy.id)?.is_archived).toBe(1);
    await setToyArchived(database, toy.id, false);
    expect(database.toys.get(toy.id)?.is_archived).toBe(0);
    await setToyAvailable(database, toy.id, false);
    expect(database.toys.get(toy.id)?.is_available).toBe(0);
    await permanentlyDeleteParentToy(database, toy.id, storage);
    expect(database.toys.has(toy.id)).toBe(false);
    expect(storage.deleted).toContain('file:///managed/blocks.jpg');
  });

  it('preserves managed image when database delete fails and does not recreate toy when cleanup fails', async () => {
    const database = new ToyTestDatabase();
    const storage = new TestImageStorage();
    const toy = await createParentToy(database, validInput(), storage);
    database.failToyDelete = true;
    await expect(permanentlyDeleteParentToy(database, toy.id, storage)).rejects.toThrow('toy delete failed');
    expect(database.toys.has(toy.id)).toBe(true);
    expect(storage.deleted).not.toContain('file:///managed/blocks.jpg');
    database.failToyDelete = false;
    storage.failDelete = true;
    await expect(permanentlyDeleteParentToy(database, toy.id, storage)).resolves.toBeUndefined();
    expect(database.toys.has(toy.id)).toBe(false);
  });

  it('updates atomically at repository level', async () => {
    const database = new ToyTestDatabase();
    const toy = await createToy(database, { name: 'Blocks', imageUri: 'file:///old.jpg', roomId: 1, storageSpotId: 2, cleanupDifficulty: 'easy', adultHelpRequired: false, isAvailable: true, isArchived: false, categories: ['building'] });
    database.failCategoryInsert = true;
    await expect(updateToy(database, toy.id, { name: 'Changed', imageUri: 'file:///new.jpg', roomId: 1, storageSpotId: 3, cleanupDifficulty: 'big', adultHelpRequired: true, isAvailable: true, isArchived: false, categories: ['quiet'] })).rejects.toThrow('category insert failed');
    expect(database.toys.get(toy.id)?.name).toBe('Blocks');
    expect(database.categories.get(toy.id)).toEqual(['building']);
  });

  it('deletes category records with permanent repository delete', async () => {
    const database = new ToyTestDatabase();
    const toy = await createToy(database, { name: 'Blocks', imageUri: 'file:///old.jpg', roomId: 1, storageSpotId: 2, cleanupDifficulty: 'easy', adultHelpRequired: false, isAvailable: true, isArchived: false, categories: ['building'] });
    await deleteToy(database, toy.id);
    expect(database.toys.has(toy.id)).toBe(false);
    expect(database.categories.has(toy.id)).toBe(false);
  });
});
