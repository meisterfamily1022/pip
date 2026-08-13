/* eslint-disable import/first */

jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(),
  setItemAsync: jest.fn(),
  deleteItemAsync: jest.fn(),
}));

import * as SecureStore from 'expo-secure-store';

import {
  getPendingVerificationSnapshot,
  pendingVerification,
  resetPendingVerificationForTests,
  restorePendingVerification,
  subscribePendingVerification,
} from './sign-up-form';

const secureStore = SecureStore as jest.Mocked<typeof SecureStore>;

describe('pending verification startup state', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    resetPendingVerificationForTests();
  });

  it('restores once and publishes the pending destination', async () => {
    secureStore.getItemAsync.mockResolvedValue('parent@example.com');
    const listener = jest.fn();
    subscribePendingVerification(listener);

    await Promise.all([restorePendingVerification(), restorePendingVerification()]);

    expect(secureStore.getItemAsync).toHaveBeenCalledTimes(1);
    expect(getPendingVerificationSnapshot()).toEqual({ status: 'ready', email: 'parent@example.com' });
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('publishes set and clear changes after secure persistence succeeds', async () => {
    secureStore.setItemAsync.mockResolvedValue();
    secureStore.deleteItemAsync.mockResolvedValue();

    await pendingVerification.set('parent@example.com');
    expect(getPendingVerificationSnapshot()).toEqual({ status: 'ready', email: 'parent@example.com' });

    await pendingVerification.clear();
    expect(getPendingVerificationSnapshot()).toEqual({ status: 'ready', email: null });
  });
});
