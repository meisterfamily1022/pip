/* eslint-disable import/first */

jest.mock('@/lib/supabase', () => ({
  supabase: { auth: { signInWithOtp: jest.fn(), verifyOtp: jest.fn(), getSession: jest.fn(), signOut: jest.fn() } },
}));

import { authError, resendVerification, sendEmailOtp, shouldBypassSimulatorAuth, signIn, verifyEmail } from './auth-client';
import { getSessionSnapshot, resetSessionStateForTests } from './session-state';
import { pendingVerification } from './sign-up-form';
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
    jest.spyOn(pendingVerification, 'clear').mockResolvedValue();
    jest.spyOn(pendingVerification, 'set').mockResolvedValue();
  });

  afterEach(() => jest.restoreAllMocks());

  it('requests a passwordless OTP and allows Supabase to create a new user', async () => {
    mockAuth.signInWithOtp.mockResolvedValue({ error: null });

    await sendEmailOtp('parent@example.com');

    expect(mockAuth.signInWithOtp).toHaveBeenCalledWith({
      email: 'parent@example.com',
      options: { shouldCreateUser: true },
    });
    expect(mockAuth.signInWithOtp).toHaveBeenCalledTimes(1);
  });

  it('clears stale pending context before requesting and stores only the accepted fresh request', async () => {
    mockAuth.signInWithOtp.mockResolvedValue({ error: null });

    await signIn(' parent@example.com ');

    expect(pendingVerification.clear).toHaveBeenCalledTimes(1);
    expect(mockAuth.signInWithOtp).toHaveBeenCalledWith({ email: 'parent@example.com', options: { shouldCreateUser: true } });
    expect(pendingVerification.set).toHaveBeenCalledWith('parent@example.com');
    expect((pendingVerification.clear as jest.Mock).mock.invocationCallOrder[0]).toBeLessThan(mockAuth.signInWithOtp.mock.invocationCallOrder[0]);
    expect(mockAuth.signInWithOtp.mock.invocationCallOrder[0]).toBeLessThan((pendingVerification.set as jest.Mock).mock.invocationCallOrder[0]);
  });

  it('leaves pending context cleared when a fresh request fails', async () => {
    mockAuth.signInWithOtp.mockResolvedValue({ error: { message: 'network request failed', status: 0 } });

    await expect(resendVerification('parent@example.com')).rejects.toMatchObject({ code: 'NETWORK_ERROR' });

    expect(pendingVerification.clear).toHaveBeenCalledTimes(1);
    expect(pendingVerification.set).not.toHaveBeenCalled();
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

  it.each([
    [{ code: 'otp_expired', message: 'OTP expired' }, 'OTP_EXPIRED', 'expired'],
    [{ code: 'otp_invalid', message: 'Invalid OTP' }, 'OTP_INVALID', 'incorrect'],
    [{ code: 'otp_used', message: 'Token was already used' }, 'OTP_USED', 'already been used'],
    [{ code: 'over_email_send_rate_limit', message: 'Too many requests', status: 429 }, 'RATE_LIMITED', 'wait'],
    [{ name: 'AuthRetryableFetchError', message: 'Failed to fetch', status: 0 }, 'NETWORK_ERROR', 'offline'],
    [{ code: 'service_failure', message: 'Database unavailable', status: 500 }, 'SERVICE_ERROR', 'service'],
  ])('maps %p to a distinct %s state', (source, expectedCode, copy) => {
    expect(authError(source)).toMatchObject({ code: expectedCode, message: expect.stringContaining(copy) });
  });

  it('does not falsely label Supabase\'s combined invalid-or-expired response as expired', () => {
    expect(authError({ code: 'otp_expired', status: 403, message: 'Token has expired or is invalid' })).toMatchObject({
      code: 'OTP_INVALID_OR_EXPIRED',
      message: expect.stringContaining('incorrect, expired, or has already been used'),
    });
  });
});
