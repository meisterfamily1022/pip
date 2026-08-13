/* eslint-disable import/first */

let mockParams: { added?: string } = {};
let mockProfiles: { id: number }[] = [];
jest.mock('expo-router', () => ({
  router: { replace: jest.fn() },
  useLocalSearchParams: () => mockParams,
}));
jest.mock('@/database/client', () => ({ initializeDatabase: jest.fn(async () => ({})) }));
jest.mock('@/repositories/child-profiles-repository', () => ({ listChildProfiles: jest.fn(async () => mockProfiles) }));
jest.mock('@/repositories/settings-repository', () => ({ markChildModeUsed: jest.fn(async () => undefined), setActiveChild: jest.fn(async () => undefined) }));
jest.mock('@/startup/route-access', () => ({ enterChildMode: jest.fn(async () => undefined) }));

import { createElement } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { router } from 'expo-router';
import { setActiveChild } from '@/repositories/settings-repository';
import { enterChildMode } from '@/startup/route-access';
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
  beforeEach(() => { mockParams = {}; mockProfiles = []; jest.clearAllMocks(); });

  it('offers shelf, manual, and explicit defer paths', async () => {
    const renderer = renderScreen();
    await act(async () => { await Promise.resolve(); });
    press(renderer, 'Photograph a shelf');
    expect(router.replace).toHaveBeenCalledWith('/parent/add-toy?mode=bulk&first=1');
    press(renderer, 'Add one toy by hand');
    expect(router.replace).toHaveBeenCalledWith('/parent/add-toy?mode=manual&first=1');
    press(renderer, 'I’ll do this later');
    expect(router.replace).toHaveBeenCalledWith('/parent/home');
  });

  it('uses the only child directly after the first toy is saved', async () => {
    mockParams = { added: '1' };
    mockProfiles = [{ id: 7 }];
    const renderer = renderScreen();
    await act(async () => { await Promise.resolve(); });
    await act(async () => press(renderer, 'Try Child Mode'));
    expect(setActiveChild).toHaveBeenCalledWith({}, 7);
    expect(enterChildMode).toHaveBeenCalledTimes(1);
    expect(router.replace).toHaveBeenCalledWith('/child/home');
  });

  it('opens the clear chooser when more than one child exists', async () => {
    mockParams = { added: '1' };
    mockProfiles = [{ id: 7 }, { id: 8 }];
    const renderer = renderScreen();
    await act(async () => { await Promise.resolve(); });
    press(renderer, 'Try Child Mode');
    expect(router.replace).toHaveBeenCalledWith('/parent/select-child');
  });
});
