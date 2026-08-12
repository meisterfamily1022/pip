import { setAuthenticatedSession, clearSession } from '@/features/auth/session-state';
import { AnalyticsPreferences, type AnalyticsGateway } from './analytics-service';

const gateway = (): jest.Mocked<AnalyticsGateway> => ({ read: jest.fn(), write: jest.fn(), deleteData: jest.fn() });

afterEach(() => clearSession());

test('guest use defaults off and cannot record consent', async () => {
  const api = gateway();
  const preferences = new AnalyticsPreferences(api);
  await expect(preferences.get()).resolves.toMatchObject({ granted: false });
  await expect(preferences.set(true)).rejects.toThrow('guest');
  expect(api.write).not.toHaveBeenCalled();
});

test('signed-in adult can opt in, opt out, and delete telemetry', async () => {
  setAuthenticatedSession({ accountId: 'adult', email: 'adult@example.test', emailVerified: true });
  const api = gateway();
  api.read.mockResolvedValue(null);
  const preferences = new AnalyticsPreferences(api);
  await expect(preferences.get()).resolves.toMatchObject({ granted: false });
  await preferences.set(true);
  await preferences.set(false);
  await preferences.delete();
  expect(api.write.mock.calls).toEqual([[true], [false]]);
  expect(api.deleteData).toHaveBeenCalledTimes(1);
});

