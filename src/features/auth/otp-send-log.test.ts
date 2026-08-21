/* eslint-disable import/first */

// A store that actually stores, so the log's own behaviour is what is under
// test rather than the mock's.
jest.mock('expo-secure-store', () => {
  const values = new Map<string, string>();
  return {
    getItemAsync: jest.fn(async (key: string) => values.get(key) ?? null),
    setItemAsync: jest.fn(async (key: string, value: string) => { values.set(key, value); }),
    deleteItemAsync: jest.fn(async (key: string) => { values.delete(key); }),
    __values: values,
  };
});

import * as SecureStore from 'expo-secure-store';

import { otpSendLog } from './otp-send-log';

const BASE = 1_800_000_000_000;

describe('the record of codes sent', () => {
  beforeEach(async () => { await otpSendLog.clear(); });

  it('knows nothing about an address no code has gone to', async () => {
    expect(await otpSendLog.forEmail('parent@example.com')).toBeNull();
  });

  it('records the first send, so the confirm screen starts its cooldown already running', async () => {
    await otpSendLog.record('parent@example.com', BASE);
    expect(await otpSendLog.forEmail('parent@example.com')).toEqual({
      email: 'parent@example.com', sentAt: BASE, attempts: 1,
    });
  });

  it('counts every code sent to the same address', async () => {
    await otpSendLog.record('parent@example.com', BASE);
    await otpSendLog.record('parent@example.com', BASE + 60_000);
    const record = await otpSendLog.record('parent@example.com', BASE + 120_000);
    expect(record).toEqual({ email: 'parent@example.com', sentAt: BASE + 120_000, attempts: 3 });
  });

  it('starts again for a different address, since its allowance is its own', async () => {
    await otpSendLog.record('first@example.com', BASE);
    await otpSendLog.record('first@example.com', BASE + 60_000);
    const record = await otpSendLog.record('second@example.com', BASE + 120_000);
    expect(record.attempts).toBe(1);
    expect(await otpSendLog.forEmail('first@example.com')).toBeNull();
  });

  it('reports nothing for an address other than the one last sent to', async () => {
    await otpSendLog.record('first@example.com', BASE);
    expect(await otpSendLog.forEmail('second@example.com')).toBeNull();
  });

  it('forgets everything once cleared', async () => {
    await otpSendLog.record('parent@example.com', BASE);
    await otpSendLog.clear();
    expect(await otpSendLog.forEmail('parent@example.com')).toBeNull();
  });

  it('treats a corrupted record as no record rather than failing sign-in', async () => {
    await (SecureStore.setItemAsync as jest.Mock)('pip.otp-send-log', 'not json');
    expect(await otpSendLog.forEmail('parent@example.com')).toBeNull();
  });

  it('goes to secure storage, not plain storage', async () => {
    await otpSendLog.record('parent@example.com', BASE);
    expect(SecureStore.setItemAsync).toHaveBeenCalledWith('pip.otp-send-log', expect.any(String));
  });
});
