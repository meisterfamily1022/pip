/* eslint-disable import/first */

jest.mock('expo-router', () => ({ router: { replace: jest.fn() } }));
jest.mock('./auth-client', () => {
  class AuthRequestError extends Error {
    code: string;
    constructor(errorCode: string, message: string) { super(message); this.code = errorCode; }
  }
  return { AuthRequestError, resendVerification: jest.fn(), verifyEmail: jest.fn() };
});

import { createElement } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { act, create, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer';
import { router } from 'expo-router';

import { AuthRequestError, resendVerification, verifyEmail } from './auth-client';
import { pendingVerification } from './sign-up-form';
import { VerifyEmailScreen } from './verify-email-screen';

const metrics = { frame: { height: 852, width: 393, x: 0, y: 0 }, insets: { bottom: 34, left: 0, right: 0, top: 59 } };

function control(renderer: ReactTestRenderer, label: string): ReactTestInstance {
  const match = renderer.root.findAll((node) => node.props.accessibilityLabel === label && (
    node.props.accessibilityRole === 'button' || typeof node.props.onChangeText === 'function'
  ))[0];
  if (!match) throw new Error(`Missing interactive control: ${label}`);
  return match;
}

async function renderScreen(): Promise<ReactTestRenderer> {
  let renderer!: ReactTestRenderer;
  await act(async () => {
    renderer = create(createElement(SafeAreaProvider, { initialMetrics: metrics }, createElement(VerifyEmailScreen)));
  });
  return renderer;
}

describe('email OTP verification interactions', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(pendingVerification, 'get').mockResolvedValue('parent@example.com');
    jest.spyOn(pendingVerification, 'clear').mockResolvedValue();
    (verifyEmail as jest.Mock).mockResolvedValue({ accountId: 'user-123' });
    (resendVerification as jest.Mock).mockResolvedValue(undefined);
  });

  afterEach(() => jest.restoreAllMocks());

  it('verifies an immediate code with Supabase first and opens onboarding', async () => {
    const renderer = await renderScreen();
    act(() => control(renderer, 'Six-digit code').props.onChangeText('123456'));

    await act(async () => control(renderer, 'Confirm email').props.onPress());

    expect(verifyEmail).toHaveBeenCalledWith('parent@example.com', '123456');
    expect((verifyEmail as jest.Mock).mock.invocationCallOrder[0]).toBeLessThan((pendingVerification.clear as jest.Mock).mock.invocationCallOrder[0]);
    expect(router.replace).toHaveBeenCalledWith('/onboarding');
  });

  it('blocks duplicate verification requests while the first is pending', async () => {
    let finish!: () => void;
    (verifyEmail as jest.Mock).mockImplementation(() => new Promise<void>((resolve) => { finish = resolve; }));
    const renderer = await renderScreen();
    act(() => control(renderer, 'Six-digit code').props.onChangeText('123456'));

    await act(async () => {
      control(renderer, 'Confirm email').props.onPress();
      control(renderer, 'Confirm email').props.onPress();
      finish();
    });

    expect(verifyEmail).toHaveBeenCalledTimes(1);
  });

  it('resends through the fresh pending-state lifecycle and clears the old code', async () => {
    const renderer = await renderScreen();
    act(() => control(renderer, 'Six-digit code').props.onChangeText('654321'));

    await act(async () => control(renderer, 'Send another code').props.onPress());

    expect(resendVerification).toHaveBeenCalledWith('parent@example.com');
    expect(control(renderer, 'Six-digit code').props.value).toBe('');
    // Names the address, so an inbox that stays empty is unambiguous.
    expect(JSON.stringify(renderer.toJSON())).toContain('A new code is on its way to parent@example.com.');
  });

  it('counts the cooldown down instead of letting the parent hit the send rate limit', async () => {
    const renderer = await renderScreen();

    expect(control(renderer, 'Send another code').props.accessibilityState.disabled).toBe(false);
    await act(async () => control(renderer, 'Send another code').props.onPress());

    // The server allows one code per address per minute; the button says so
    // rather than letting the next press come back as over_email_send_rate_limit.
    const cooling = control(renderer, 'Send another code in 60s');
    expect(cooling.props.accessibilityState.disabled).toBe(true);
    expect(resendVerification).toHaveBeenCalledTimes(1);
  });

  it('does not start a cooldown when the send itself failed', async () => {
    (resendVerification as jest.Mock).mockRejectedValueOnce(
      new AuthRequestError('NETWORK_ERROR', 'You appear to be offline. Check your connection and try again.'),
    );
    const renderer = await renderScreen();

    await act(async () => control(renderer, 'Send another code').props.onPress());

    // Nothing was sent, so nothing should stop the parent trying again.
    expect(control(renderer, 'Send another code').props.accessibilityState.disabled).toBe(false);
  });

  it.each([
    ['OTP_EXPIRED', 'That code has expired. Send a new code and try again.'],
    ['OTP_INVALID', 'That code is incorrect. Check the newest code and try again.'],
    ['OTP_USED', 'That code has already been used. Send a new code and try again.'],
    ['RATE_LIMITED', 'Please wait a moment before requesting or checking another code.'],
    ['DNS_ERROR', 'Pip could not find the sign-in service. Check your connection and try again.'],
    ['TLS_ERROR', 'Pip could not establish a secure connection to the sign-in service. Try again shortly.'],
    ['CONNECTION_ERROR', 'Pip could not connect to the sign-in service. Check your connection and try again.'],
    ['NETWORK_ERROR', 'You appear to be offline. Check your connection and try again.'],
    ['SERVICE_ERROR', 'The sign-in service could not complete the request. Try again shortly.'],
  ])('renders the distinct %s message', async (code, message) => {
    (verifyEmail as jest.Mock).mockRejectedValue(new AuthRequestError(code, message));
    const renderer = await renderScreen();
    act(() => control(renderer, 'Six-digit code').props.onChangeText('000000'));
    await act(async () => control(renderer, 'Confirm email').props.onPress());
    expect(JSON.stringify(renderer.toJSON())).toContain(message);
  });
});
