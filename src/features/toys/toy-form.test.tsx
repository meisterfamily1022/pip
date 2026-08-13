import { createElement } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';

import { ToyForm } from '@/components/toy-form';
import * as toyMediaIntake from '@/features/toys/toy-media-intake';

const location = {
  id: 1,
  name: 'Playroom',
  createdAt: '',
  updatedAt: '',
  storageSpots: [{ id: 2, name: 'Shelf', roomId: 1, createdAt: '', updatedAt: '' }],
};

describe('toy form guidance', () => {
  it('explains why kinds of play are requested to assistive technology', () => {
    let renderer: ReactTestRenderer;
    act(() => {
      renderer = create(createElement(SafeAreaProvider, { initialMetrics: {
        frame: { height: 852, width: 393, x: 0, y: 0 },
        insets: { bottom: 34, left: 0, right: 0, top: 59 },
      } }, createElement(ToyForm, {
        error: null,
        locations: [location],
        onSubmit: jest.fn(async () => undefined),
        saving: false,
        submitLabel: 'Save toy',
      })));
    });

    const purpose = renderer!.root.findByProps({ accessibilityLabel: 'Why Pip asks for kinds of play' });
    expect(purpose.props.children).toBe('These help Pip offer choices that fit the moment.');
  });

  it('hands permanently blocked camera access to the route recovery screen', async () => {
    jest.spyOn(toyMediaIntake, 'captureWithSystemCamera').mockResolvedValueOnce({
      assets: [],
      blockedPermission: 'camera',
      cancelled: false,
      error: 'Camera access is blocked in device settings.',
      uris: [],
    });
    const onCameraBlocked = jest.fn();
    let renderer: ReactTestRenderer;
    await act(async () => {
      renderer = create(createElement(SafeAreaProvider, { initialMetrics: {
        frame: { height: 852, width: 393, x: 0, y: 0 },
        insets: { bottom: 34, left: 0, right: 0, top: 59 },
      } }, createElement(ToyForm, {
        error: null,
        locations: [location],
        onCameraBlocked,
        onSubmit: jest.fn(async () => undefined),
        saving: false,
        submitLabel: 'Save toy',
      })));
    });

    await act(async () => {
      await renderer!.root.findByProps({ accessibilityLabel: 'Camera' }).props.onPress();
    });

    expect(onCameraBlocked).toHaveBeenCalledTimes(1);
  });
});
