/* eslint-disable import/first */

jest.mock('expo-router', () => ({
  router: { push: jest.fn(), replace: jest.fn() },
}));

jest.mock('./auth-client', () => ({
  AuthRequestError: class AuthRequestError extends Error {},
  signIn: jest.fn(),
}));

import { createElement } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { act, create, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer';
import { router } from 'expo-router';

import { signIn } from './auth-client';
import { pendingVerification } from './sign-up-form';
import { SignInScreen } from './sign-in-screen';

const metrics = { frame: { height: 852, width: 393, x: 0, y: 0 }, insets: { bottom: 34, left: 0, right: 0, top: 59 } };

function renderScreen(): ReactTestRenderer {
  let renderer: ReactTestRenderer | undefined;
  act(() => {
    renderer = create(createElement(SafeAreaProvider, { initialMetrics: metrics }, createElement(SignInScreen)));
  });
  return renderer!;
}

function control(renderer: ReactTestRenderer, label: string): ReactTestInstance {
  const match = renderer.root.findAll((node) => node.props.accessibilityLabel === label && (
    node.props.accessibilityRole === 'button' || typeof node.props.onChangeText === 'function'
  ))[0];
  if (!match) throw new Error(`Missing interactive control: ${label}`);
  return match;
}

describe('native sign-in interactions', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(pendingVerification, 'set').mockResolvedValue();
    (signIn as jest.Mock).mockResolvedValue(undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('renders an editable email field that accepts text and enables OTP only for a valid address', () => {
    const renderer = renderScreen();
    const email = control(renderer, 'Email');
    expect(email.props.editable).not.toBe(false);
    expect(control(renderer, 'Email me a code').props.disabled).toBe(true);

    act(() => email.props.onChangeText('not-an-email'));
    expect(control(renderer, 'Email me a code').props.disabled).toBe(true);

    act(() => control(renderer, 'Email').props.onChangeText(' parent@example.com '));
    expect(control(renderer, 'Email').props.value).toBe(' parent@example.com ');
    expect(control(renderer, 'Email me a code').props.disabled).toBe(false);
  });

  it('navigates to account creation when the quiet action is pressed', () => {
    const renderer = renderScreen();
    act(() => control(renderer, 'Create an account instead').props.onPress());
    expect(router.replace).toHaveBeenCalledWith('/sign-up');
  });

  it('sends the trimmed email, persists it, and opens verification', async () => {
    const renderer = renderScreen();
    act(() => control(renderer, 'Email').props.onChangeText(' parent@example.com '));

    await act(async () => {
      control(renderer, 'Email me a code').props.onPress();
    });

    expect(signIn).toHaveBeenCalledWith('parent@example.com');
    expect(pendingVerification.set).toHaveBeenCalledWith('parent@example.com');
    expect(router.push).toHaveBeenCalledWith('/verify-email');
  });
});
