/* eslint-disable import/first */

jest.mock('@/lib/supabase', () => ({
  supabase: { auth: { signInWithOtp: jest.fn(), verifyOtp: jest.fn(), getSession: jest.fn(), signOut: jest.fn() } },
}));

import { resendVerification, sendEmailOtp, shouldBypassSimulatorAuth, verifyEmail } from './auth-client';
import { getSessionSnapshot, resetSessionStateForTests } from './session-state';
import { supabase } from '@/lib/supabase';

const mockAuth = supabase.auth as unknown as {
  signInWithOtp: jest.Mock;
  verifyOtp: jest.Mock;
  getSession: jest.Mock;
  signOut: jest.Mock;
};

describe('Supabase email OTP authentication', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    resetSessionStateForTests();
  });

  it('requests a passwordless OTP and allows Supabase to create a new user', async () => {
    mockAuth.signInWithOtp.mockResolvedValue({ error: null });

    await sendEmailOtp('parent@example.com');
    await resendVerification('parent@example.com');

    expect(mockAuth.signInWithOtp).toHaveBeenCalledWith({
      email: 'parent@example.com',
      options: { shouldCreateUser: true },
    });
    expect(mockAuth.signInWithOtp).toHaveBeenCalledTimes(2);
  });

  it('allows the controlled OTP path only in an opted-in iOS simulator bundle', () => {
    expect(shouldBypassSimulatorAuth({ enabled: true, platform: 'ios', isPhysicalDevice: false })).toBe(true);
    expect(shouldBypassSimulatorAuth({ enabled: false, platform: 'ios', isPhysicalDevice: false })).toBe(false);
    expect(shouldBypassSimulatorAuth({ enabled: true, platform: 'ios', isPhysicalDevice: true })).toBe(false);
    expect(shouldBypassSimulatorAuth({ enabled: true, platform: 'android', isPhysicalDevice: false })).toBe(false);
  });

  it('verifies the six-digit email OTP and publishes the authenticated user', async () => {
    mockAuth.verifyOtp.mockResolvedValue({
      error: null,
      data: { user: { id: 'user-123', email: 'parent@example.com', email_confirmed_at: '2026-08-11T00:00:00Z' } },
    });

    await verifyEmail('parent@example.com', '123456');

    expect(mockAuth.verifyOtp).toHaveBeenCalledWith({ email: 'parent@example.com', token: '123456', type: 'email' });
    expect(getSessionSnapshot()).toMatchObject({ status: 'signedIn', account: { accountId: 'user-123' } });
  });
});
