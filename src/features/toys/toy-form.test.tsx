import { createElement } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';

import { ToyForm } from '@/components/toy-form';

describe('toy form guidance', () => {
  it('explains why kinds of play are requested to assistive technology', () => {
    let renderer: ReactTestRenderer;
    act(() => {
      renderer = create(createElement(SafeAreaProvider, { initialMetrics: {
        frame: { height: 852, width: 393, x: 0, y: 0 },
        insets: { bottom: 34, left: 0, right: 0, top: 59 },
      } }, createElement(ToyForm, {
        error: null,
        locations: [{
          id: 1,
          name: 'Playroom',
          createdAt: '',
          updatedAt: '',
          storageSpots: [{ id: 2, name: 'Shelf', roomId: 1, createdAt: '', updatedAt: '' }],
        }],
        onSubmit: jest.fn(async () => undefined),
        saving: false,
        submitLabel: 'Save toy',
      })));
    });

    const purpose = renderer!.root.findByProps({ accessibilityLabel: 'Why Pip asks for kinds of play' });
    expect(purpose.props.children).toBe('These help Pip offer choices that fit the moment.');
  });
});
