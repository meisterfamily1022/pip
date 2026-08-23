import { createElement } from 'react';
import { act, create, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer';

import { ToyPhoto } from './toy-photo';

function render(element: ReturnType<typeof createElement>): ReactTestRenderer {
  let renderer: ReactTestRenderer | undefined;
  act(() => { renderer = create(element); });
  return renderer!;
}

function findImage(renderer: ReactTestRenderer): ReactTestInstance | undefined {
  return renderer.root.findAll((node) => String(node.type) === 'ViewManagerAdapter_ExpoImage')[0];
}

function findActivityIndicator(renderer: ReactTestRenderer): ReactTestInstance[] {
  return renderer.root.findAll((node) => String(node.type) === 'ActivityIndicator');
}

function fakeNativeEvent(): { nativeEvent: Record<string, never> } { return { nativeEvent: {} }; }

function findPipIcon(renderer: ReactTestRenderer, name: string): ReactTestInstance[] {
  return renderer.root.findAll((node) => node.props.name === name && typeof node.props.size === 'number');
}

function pressableWithLabel(renderer: ReactTestRenderer, label: string): ReactTestInstance | undefined {
  return renderer.root.findAll((node) =>
    node.props.accessibilityLabel === label && node.props.accessibilityRole === 'button')[0];
}

describe('cold-cache loading state', () => {
  it('shows a loading indicator over the frame before the image reports it has loaded', () => {
    const renderer = render(createElement(ToyPhoto, { name: 'Blocks', uri: 'file:///toy.jpg' }));
    expect(findActivityIndicator(renderer)).toHaveLength(1);
  });

  it('removes the loading indicator once the image reports it has loaded', () => {
    const renderer = render(createElement(ToyPhoto, { name: 'Blocks', uri: 'file:///toy.jpg' }));
    act(() => { findImage(renderer)!.props.onLoad(fakeNativeEvent()); });
    expect(findActivityIndicator(renderer)).toHaveLength(0);
  });

  it('resets to loading when a recycled row is handed a different photo', () => {
    const renderer = render(createElement(ToyPhoto, { name: 'Blocks', uri: 'file:///toy-a.jpg' }));
    act(() => { findImage(renderer)!.props.onLoad(fakeNativeEvent()); });
    expect(findActivityIndicator(renderer)).toHaveLength(0);

    act(() => { renderer.update(createElement(ToyPhoto, { name: 'Puzzle', uri: 'file:///toy-b.jpg' })); });
    expect(findActivityIndicator(renderer)).toHaveLength(1);
  });
});

describe('failure and retry', () => {
  it('falls back to the alert icon and a retry control when the image fails to load', () => {
    const renderer = render(createElement(ToyPhoto, { name: 'Blocks', uri: 'file:///missing.jpg' }));
    act(() => { findImage(renderer)!.props.onError(fakeNativeEvent()); });

    expect(findImage(renderer)).toBeUndefined();
    expect(findPipIcon(renderer, 'alert')).toHaveLength(1);
    expect(pressableWithLabel(renderer, 'Try loading the photo again')).toBeDefined();
  });

  it('re-attempts the image, with a fresh recycling key, when retry is pressed', () => {
    const renderer = render(createElement(ToyPhoto, { name: 'Blocks', uri: 'file:///missing.jpg' }));
    act(() => { findImage(renderer)!.props.onError(fakeNativeEvent()); });
    const initialRetry = pressableWithLabel(renderer, 'Try loading the photo again')!;

    act(() => { initialRetry.props.onPress(); });

    const image = findImage(renderer);
    expect(image).toBeDefined();
    expect(image!.props.recyclingKey).toBe('file:///missing.jpg:1');
    // Back to the loading state for the fresh attempt, not the stale failure.
    expect(findActivityIndicator(renderer)).toHaveLength(1);
  });

  it('does not offer a retry control at the small tier, where there is no room for one', () => {
    const renderer = render(createElement(ToyPhoto, { name: 'Blocks', tier: 'small', uri: 'file:///missing.jpg' }));
    act(() => { findImage(renderer)!.props.onError(fakeNativeEvent()); });
    expect(pressableWithLabel(renderer, 'Try loading the photo again')).toBeUndefined();
  });

  it('has no retry control while there is simply no photo at all', () => {
    const renderer = render(createElement(ToyPhoto, { name: 'Blocks', uri: null }));
    expect(pressableWithLabel(renderer, 'Try loading the photo again')).toBeUndefined();
    expect(findPipIcon(renderer, 'photo-missing')).toHaveLength(1);
  });
});
