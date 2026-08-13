/* eslint-disable import/first */

let mockParams: { added?: string } = {};
jest.mock('expo-router', () => ({
  router: { replace: jest.fn() },
  useLocalSearchParams: () => mockParams,
}));

import { createElement } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { router } from 'expo-router';
import FirstToyRoute from '@/app/(parent)/parent/first-toy';

const metrics = { frame: { height: 852, width: 393, x: 0, y: 0 }, insets: { bottom: 34, left: 0, right: 0, top: 59 } };
function renderScreen(): ReactTestRenderer {
  let renderer: ReactTestRenderer | undefined;
  act(() => { renderer = create(createElement(SafeAreaProvider, { initialMetrics: metrics }, createElement(FirstToyRoute))); });
  return renderer!;
}
function press(renderer: ReactTestRenderer, label: string): void {
  const control = renderer.root.findAll((node) => node.props.accessibilityLabel === label && node.props.accessibilityRole === 'button')[0];
  act(() => control.props.onPress());
}

describe('first toy handoff', () => {
  beforeEach(() => { mockParams = {}; jest.clearAllMocks(); });

  it('offers shelf, manual, and explicit defer paths', () => {
    const renderer = renderScreen();
    press(renderer, 'Photograph a shelf');
    expect(router.replace).toHaveBeenCalledWith('/parent/add-toy?mode=bulk&first=1');
    press(renderer, 'Add one toy by hand');
    expect(router.replace).toHaveBeenCalledWith('/parent/add-toy?mode=manual&first=1');
    press(renderer, 'I’ll do this later');
    expect(router.replace).toHaveBeenCalledWith('/parent/home');
  });

  it('offers Child Mode immediately after the first toy is saved', () => {
    mockParams = { added: '1' };
    const renderer = renderScreen();
    press(renderer, 'Try Child Mode');
    expect(router.replace).toHaveBeenCalledWith('/parent/select-child');
  });
});
