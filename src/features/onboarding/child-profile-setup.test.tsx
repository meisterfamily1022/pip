/* eslint-disable import/first */

jest.mock('expo-router', () => ({ router: { back: jest.fn(), canGoBack: jest.fn(() => true), push: jest.fn(), replace: jest.fn() } }));

const mockUpdateDraft = jest.fn();
const mockDraft = {
  pin: '1234', pinConfirmation: '1234', childNickname: '', childAvatarId: 'circle-dot', childAccentColorId: 'mint',
  childReadingSupport: 'pictures-words', choiceLimit: 3 as const, cleanupRequired: true, roomName: '', storageSpotName: '',
};

jest.mock('./onboarding-context', () => ({ useOnboarding: () => ({ draft: mockDraft, updateDraft: mockUpdateDraft }) }));

import { createElement } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { router } from 'expo-router';
import ChildProfileSetupRoute from '@/app/(onboarding)/child-profile-setup';

const metrics = { frame: { height: 852, width: 393, x: 0, y: 0 }, insets: { bottom: 34, left: 0, right: 0, top: 59 } };

function renderScreen(): ReactTestRenderer {
  let renderer: ReactTestRenderer | undefined;
  act(() => { renderer = create(createElement(SafeAreaProvider, { initialMetrics: metrics }, createElement(ChildProfileSetupRoute))); });
  return renderer!;
}

describe('first child profile setup', () => {
  beforeEach(() => jest.clearAllMocks());

  it('has no placeholder-profile bypass and announces a required-name error', () => {
    const renderer = renderScreen();
    expect(renderer.root.findAll((node) => node.props.accessibilityLabel === 'Set this up later')).toHaveLength(0);
    const next = renderer.root.findAll((node) => node.props.accessibilityLabel === 'Next: reading & cleanup')[0];
    act(() => next.props.onPress());
    expect(router.push).not.toHaveBeenCalled();
    expect(renderer.root.findAll((node) => node.props.accessibilityLiveRegion === 'polite' && node.props.children === 'Child nickname is required.').length).toBeGreaterThan(0);
  });
});
