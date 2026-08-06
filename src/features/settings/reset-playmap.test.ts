import type { DatabaseConnection, SqlParameters, SqlRunResult } from '@/database/types';
import type { ToyImageStorage } from '@/features/toys/toy-image-storage';
import type { PinStorage } from '@/services/pin-storage';
import { resetPlayMapData } from './reset-playmap';

class ResetDatabase implements DatabaseConnection {
  public calls: string[] = [];
  public failDuringReset = false;
  async execAsync(): Promise<void> {}
  async withTransactionAsync(task: () => Promise<void>): Promise<void> { this.calls.push('BEGIN'); await task(); this.calls.push('COMMIT'); }
  async runAsync(source: string, ..._params: SqlParameters): Promise<SqlRunResult> { this.calls.push(source.split(';')[0] ?? source); if (this.failDuringReset && source.startsWith('DELETE FROM toys')) throw new Error('database reset failed'); return { lastInsertRowId: 0, changes: 1 }; }
  async getFirstAsync<T>(): Promise<T | null> { return null; }
  async getAllAsync<T>(): Promise<T[]> {
    return [{ image_uri: 'managed://one', original_image_uri: 'managed://one', enhanced_image_uri: 'managed://two' }] as T[];
  }
}

class ResetImages implements ToyImageStorage {
  public deleted: string[] = [];
  async copyIntoManagedStorage(uri: string): Promise<string> { return uri; }
  async deleteManagedImage(uri: string | null): Promise<void> { if (uri) this.deleted.push(uri); }
}

class ResetPins implements PinStorage {
  public deleted = false;
  public failDelete = false;
  public saved: string[] = [];
  public pin: string | null = '2468';
  async savePin(pin: string): Promise<void> { this.pin = pin; this.saved.push(pin); }
  async getPin(): Promise<string | null> { return this.pin; }
  async deletePin(): Promise<void> { if (this.failDelete) throw new Error('secure storage unavailable'); this.pin = null; this.deleted = true; }
}

describe('resetPlayMapData', () => {
  it('deletes personalized rows in foreign-key-safe order and deduplicates images', async () => {
    const database = new ResetDatabase();
    const images = new ResetImages();
    const pins = new ResetPins();
    await expect(resetPlayMapData(database, images, pins)).resolves.toEqual({ imageCleanupFailures: 0 });
    expect(database.calls).toEqual([
      'BEGIN',
      'DELETE FROM play_sessions',
      'DELETE FROM child_profiles',
      'DELETE FROM toy_categories',
      'DELETE FROM toy_setup_drafts',
      'DELETE FROM toys',
      'DELETE FROM storage_spots',
      'DELETE FROM rooms',
      expect.stringContaining('UPDATE settings SET onboarding_completed = 0'),
      'COMMIT',
    ]);
    expect(images.deleted).toEqual(['managed://one', 'managed://two']);
    expect(pins.deleted).toBe(true);
    expect(database.calls.join('\n')).not.toMatch(/\bAri\b|Review Playroom|child_nickname = ['"]b['"]/);
    expect(database.calls.join('\n')).toContain('child_nickname = NULL');
  });

  it('does not touch database rows when secure PIN deletion fails', async () => {
    const database = new ResetDatabase();
    const pins = new ResetPins();
    pins.failDelete = true;
    await expect(resetPlayMapData(database, new ResetImages(), pins)).rejects.toThrow('secure storage unavailable');
    expect(database.calls).toEqual([]);
    expect(pins.pin).toBe('2468');
  });

  it('restores the parent PIN when the database transaction fails', async () => {
    const database = new ResetDatabase();
    database.failDuringReset = true;
    const pins = new ResetPins();
    await expect(resetPlayMapData(database, new ResetImages(), pins)).rejects.toThrow('database reset failed');
    expect(pins.saved).toEqual(['2468']);
    expect(pins.pin).toBe('2468');
  });
});
