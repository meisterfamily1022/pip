import { createElement } from 'react';
import { Text } from 'react-native';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';

import PrivacyRoute from '@/app/privacy';

describe('privacy notice', () => {
  it('is final user-facing copy and matches implemented controls', () => {
    let renderer: ReactTestRenderer;
    act(() => { renderer = create(createElement(PrivacyRoute)); });
    const copy = renderer!.root.findAllByType(Text)
      .flatMap((node) => node.props.children)
      .filter((value): value is string => typeof value === 'string')
      .join(' ');

    expect(copy).not.toMatch(/draft|pending review/i);
    expect(copy).toMatch(/does not currently provide in-app account deletion/i);
    expect(copy).toMatch(/photos themselves are not included in the export/i);
    expect(copy).toMatch(/choice starts off/i);
  });
});
