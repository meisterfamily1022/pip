/* eslint-disable import/first */

jest.mock('expo-router', () => ({ router: { push: jest.fn(), replace: jest.fn() } }));
jest.mock('@/services/onboarding-progress-storage', () => ({
  onboardingProgressStorage: { markStarted: jest.fn(async () => undefined) },
}));

import { createElement } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';

import OnboardingHomeRoute from '@/app/(onboarding)/onboarding';

const metrics = { frame: { height: 852, width: 393, x: 0, y: 0 }, insets: { bottom: 34, left: 0, right: 0, top: 59 } };

function renderScreen(): ReactTestRenderer {
  let renderer: ReactTestRenderer | undefined;
  act(() => {
    renderer = create(createElement(SafeAreaProvider, { initialMetrics: metrics }, createElement(OnboardingHomeRoute)));
  });
  return renderer!;
}

function labels(renderer: ReactTestRenderer): string[] {
  return renderer.root
    .findAll((node) => node.props.accessibilityRole === 'button' && typeof node.props.onPress === 'function')
    .map((node) => String(node.props.accessibilityLabel));
}

function textContent(renderer: ReactTestRenderer): string {
  const seen = new Set<string>();
  for (const node of renderer.root.findAll(() => true)) {
    const children = node.props?.children;
    for (const child of Array.isArray(children) ? children : [children]) {
      if (typeof child === 'string') seen.add(child);
    }
  }
  return [...seen].join(' | ');
}

describe('the first thing a parent sees', () => {
  it('leads with setting Pip up on this device', () => {
    const renderer = renderScreen();

    expect(labels(renderer)).toContain('Set up Pip on this device');
  });

  it('offers sign-in for an existing account, and account creation below it', () => {
    const order = labels(renderScreen());

    expect(order.indexOf('I already have an account')).toBeGreaterThan(-1);
    expect(order).toContain('Create an account');
  });

  it('does not sell an account on a benefit Pip does not have', () => {
    const copy = textContent(renderScreen());

    expect(copy).toContain('does not back anything up yet');
    expect(copy).not.toMatch(/back(ed)? up your|keep your library safe|never lose|sync/i);
  });

  it('says outright that Pip works without an account', () => {
    expect(textContent(renderScreen())).toContain('works without an account');
  });
});
