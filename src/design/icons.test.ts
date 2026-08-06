import { Children, type ReactElement, type ReactNode } from 'react';

import { ModeDiamondIcon } from './icons';

describe('ModeDiamondIcon', () => {
  it('rotates around its center without emitting an origin prop', () => {
    const icon = ModeDiamondIcon({});
    const rotation = Children.only(icon.props.children) as ReactElement<{
      children?: ReactNode;
      origin?: string;
      transform?: string;
      transformOrigin?: string;
      'transform-origin'?: string;
    }>;
    const diamond = Children.only(rotation.props.children) as ReactElement;

    expect(rotation.props.transform).toBe('rotate(45 12 12)');
    expect(rotation.props.origin).toBeUndefined();
    expect(rotation.props.transformOrigin).toBeUndefined();
    expect(rotation.props['transform-origin']).toBeUndefined();
    expect(diamond.props).toMatchObject({ height: 16, width: 16, x: 4, y: 4 });
  });
});
