import type { DatabaseConnection, SqlParameters, SqlRunResult } from '@/database/types';
import type { PinStorage } from '@/services/pin-storage';
import { changeParentPin, saveParentSettings, SettingsValidationError } from './settings-service';
import { getSettings } from '@/repositories/settings-repository';

class SettingsTestDatabase implements DatabaseConnection {
  public settings = { onboarding_completed: 1, child_nickname: 'Ari', choice_limit: 3, cleanup_required: 1, created_at: '', updated_at: '' };
  async execAsync(): Promise<void> {}
  async withTransactionAsync(task: () => Promise<void>): Promise<void> { await task(); }
  async runAsync(source: string, ...params: SqlParameters): Promise<SqlRunResult> {
    if (source.startsWith('UPDATE settings')) {
      this.settings = { onboarding_completed: params[0] as number, child_nickname: params[1] as string, choice_limit: params[2] as number, cleanup_required: params[3] as number, created_at: '', updated_at: params[4] as string };
      return { lastInsertRowId: 1, changes: 1 };
    }
    throw new Error(`Unhandled SQL: ${source}`);
  }
  async getFirstAsync<T>(source: string): Promise<T | null> {
    if (source.includes('FROM settings')) return this.settings as T;
    throw new Error(`Unhandled SQL: ${source}`);
  }
  async getAllAsync<T>(): Promise<T[]> { return []; }
}

class TestPinStorage implements PinStorage {
  public pin: string | null = '1234';
  public failNextSave = false;
  async savePin(pin: string): Promise<void> {
    if (this.failNextSave) {
      this.failNextSave = false;
      this.pin = 'partial';
      throw new Error('save failed');
    }
    this.pin = pin;
  }
  async getPin(): Promise<string | null> { return this.pin; }
  async deletePin(): Promise<void> { this.pin = null; }
}

describe('parent settings service', () => {
  it('trims and persists nickname, choice limit, and cleanup setting', async () => {
    const database = new SettingsTestDatabase();
    await expect(saveParentSettings(database, { childNickname: '  Jo  ', choiceLimit: 5, cleanupRequired: false })).resolves.toMatchObject({ childNickname: 'Jo', choiceLimit: 5, cleanupRequired: false });
    await expect(getSettings(database)).resolves.toMatchObject({ childNickname: 'Jo', choiceLimit: 5, cleanupRequired: false });
  });

  it('rejects empty nickname and invalid choice limits', async () => {
    const database = new SettingsTestDatabase();
    await expect(saveParentSettings(database, { childNickname: ' ', choiceLimit: 3, cleanupRequired: true })).rejects.toBeInstanceOf(SettingsValidationError);
    await expect(saveParentSettings(database, { childNickname: 'Jo', choiceLimit: 2, cleanupRequired: true })).rejects.toThrow('Choice limit must be 1, 3, or 5.');
  });
});

describe('parent PIN change', () => {
  it('validates current PIN, new PIN, and confirmation', async () => {
    const storage = new TestPinStorage();
    await expect(changeParentPin(storage, { currentPin: '0000', newPin: '5678', confirmation: '5678' })).rejects.toThrow('Current PIN is not correct.');
    await expect(changeParentPin(storage, { currentPin: '1234', newPin: '567', confirmation: '567' })).rejects.toThrow('Enter a four-digit numeric PIN.');
    await expect(changeParentPin(storage, { currentPin: '1234', newPin: '5678', confirmation: '8765' })).rejects.toThrow('The PINs do not match.');
  });

  it('changes the PIN and invalidates the old PIN', async () => {
    const storage = new TestPinStorage();
    await changeParentPin(storage, { currentPin: '1234', newPin: '5678', confirmation: '5678' });
    await expect(storage.getPin()).resolves.toBe('5678');
    await expect(changeParentPin(storage, { currentPin: '1234', newPin: '9999', confirmation: '9999' })).rejects.toThrow('Current PIN is not correct.');
  });

  it('restores the old PIN when saving the new PIN fails', async () => {
    const storage = new TestPinStorage();
    storage.failNextSave = true;
    await expect(changeParentPin(storage, { currentPin: '1234', newPin: '5678', confirmation: '5678' })).rejects.toThrow('save failed');
    await expect(storage.getPin()).resolves.toBe('1234');
  });
});
