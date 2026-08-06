import type { DatabaseConnection, SqlParameters, SqlRunResult } from '@/database/types';
import type { PinStorage } from '@/services/pin-storage';
import { assertReviewFixtureAllowed, REVIEW_FIXTURE_PIN, seedReviewFixture } from './review-fixture';

class FixtureDatabase implements DatabaseConnection {
  public calls: { source: string; params: SqlParameters }[] = [];
  async execAsync(): Promise<void> {}
  async runAsync(source: string, ...params: SqlParameters): Promise<SqlRunResult> { this.calls.push({ source, params }); return { lastInsertRowId: 0, changes: 1 }; }
  async getFirstAsync<T>(): Promise<T | null> { return null; }
  async getAllAsync<T>(): Promise<T[]> { return []; }
  async withTransactionAsync(task: () => Promise<void>): Promise<void> { await task(); }
}

class FixturePins implements PinStorage {
  public pin: string | null = null;
  async savePin(pin: string): Promise<void> { this.pin = pin; }
  async getPin(): Promise<string | null> { return this.pin; }
  async deletePin(): Promise<void> { this.pin = null; }
}

describe('seedReviewFixture', () => {
  it('cannot run in a production build', () => {
    expect(() => assertReviewFixtureAllowed(false)).toThrow('disabled in production');
  });

  it('uses stable valid room, spot, toy, and category identities', async () => {
    const database = new FixtureDatabase();
    const pins = new FixturePins();
    await seedReviewFixture(database, pins);
    expect(pins.pin).toBe(REVIEW_FIXTURE_PIN);
    expect(database.calls.filter(({ source }) => source.includes('INSERT INTO toys'))).toHaveLength(4);
    expect(database.calls.filter(({ source }) => source.includes('toy_categories'))).toHaveLength(4);
    expect(database.calls.some(({ source }) => source.includes('onboarding_completed = 1'))).toBe(true);
    expect(database.calls.find(({ params }) => params[0] === 910001 && params[1] === 'Review Blocks')?.params.slice(2, 4)).toEqual([910001, 910001]);
  });
});
