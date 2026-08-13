/* eslint-disable import/first */

jest.mock('expo-router', () => ({
  router: { push: jest.fn(), replace: jest.fn() },
}));

jest.mock('./auth-client', () => ({
  AuthRequestError: class AuthRequestError extends Error {},
  signUp: jest.fn(),
}));

import { createElement } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { act, create, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer';
import { router } from 'expo-router';

import { signUp } from './auth-client';
import { pendingVerification } from './sign-up-form';
import { SignUpScreen } from './sign-up-screen';

const metrics = { frame: { height: 852, width: 393, x: 0, y: 0 }, insets: { bottom: 34, left: 0, right: 0, top: 59 } };

function renderScreen(): ReactTestRenderer {
  let renderer: ReactTestRenderer | undefined;
  act(() => {
    renderer = create(createElement(SafeAreaProvider, { initialMetrics: metrics }, createElement(SignUpScreen)));
  });
  return renderer!;
}

function control(renderer: ReactTestRenderer, label: string): ReactTestInstance {
  const match = renderer.root.findAll((node) => node.props.accessibilityLabel === label && (
    node.props.accessibilityRole === 'button'
    || node.props.accessibilityRole === 'checkbox'
    || typeof node.props.onChangeText === 'function'
  ))[0];
  if (!match) throw new Error(`Missing interactive control: ${label}`);
  return match;
}

describe('native sign-up interactions', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(pendingVerification, 'set').mockResolvedValue();
    (signUp as jest.Mock).mockResolvedValue(undefined);
  });

  afterEach(() => jest.restoreAllMocks());

  it('returns to sign-in exactly once per press', () => {
    const renderer = renderScreen();
    act(() => control(renderer, 'Already have an account? Sign in').props.onPress());
    expect(router.replace).toHaveBeenCalledTimes(1);
    expect(router.replace).toHaveBeenCalledWith('/sign-in');
  });

  it('opens verification only after a successful OTP request', async () => {
    const renderer = renderScreen();
    act(() => control(renderer, 'Email').props.onChangeText('parent@example.com'));
    act(() => control(renderer, 'I accept the terms of service and privacy notice').props.onPress());

    await act(async () => control(renderer, 'Email me a code').props.onPress());

    expect(signUp).toHaveBeenCalledWith({ email: 'parent@example.com' });
    expect(pendingVerification.set).toHaveBeenCalledWith('parent@example.com');
    expect(router.replace).toHaveBeenCalledTimes(1);
    expect(router.replace).toHaveBeenCalledWith('/verify-email');
  });

  it('does not navigate when the OTP request fails', async () => {
    (signUp as jest.Mock).mockRejectedValue(new Error('offline'));
    const renderer = renderScreen();
    act(() => control(renderer, 'Email').props.onChangeText('parent@example.com'));
    act(() => control(renderer, 'I accept the terms of service and privacy notice').props.onPress());

    await act(async () => control(renderer, 'Email me a code').props.onPress());

    expect(router.replace).not.toHaveBeenCalled();
  });
});
