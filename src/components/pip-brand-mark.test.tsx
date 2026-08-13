import { createElement } from 'react';
import { act, create, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer';

import { PipBrandMark } from './pip-brand-mark';

function artworkGroups(node: ReactTestInstance): ReactTestInstance[] {
  return node.findAll((candidate) => typeof candidate.props.transform === 'string' && candidate.props.transform.endsWith(' 1100)'));
}

function svgViewBox(node: ReactTestInstance): string {
  return node.findAll((candidate) => candidate.props.viewBox)[0].props.viewBox;
}

function render(variant: 'wordmark' | 'mark'): ReactTestRenderer {
  let renderer: ReactTestRenderer | undefined;
  act(() => {
    renderer = create(createElement(PipBrandMark, { variant, width: variant === 'wordmark' ? 54 : 44 }));
  });
  return renderer!;
}

describe('PipBrandMark', () => {
  it('keeps the approved wordmark artwork offset inside a safely padded viewBox', () => {
    const renderer = render('wordmark');

    expect(svgViewBox(renderer.root)).toBe('70 25 1457 1307');
    expect(artworkGroups(renderer.root)).toEqual(
      expect.arrayContaining([expect.objectContaining({ props: expect.objectContaining({ transform: 'translate(60 1100)' }) })]),
    );
  });

  it('does not apply the wordmark offset to the compact mark', () => {
    const renderer = render('mark');

    expect(svgViewBox(renderer.root)).toBe('10 25 622 1307');
    expect(artworkGroups(renderer.root)).toEqual(
      expect.arrayContaining([expect.objectContaining({ props: expect.objectContaining({ transform: 'translate(0 1100)' }) })]),
    );
  });
});
