import { normalizeChildName } from './child-name';

describe('the canonical child-name rule', () => {
  it('folds case', () => {
    expect(normalizeChildName('SAM')).toBe(normalizeChildName('sam'));
  });

  it('drops leading and trailing whitespace of any kind', () => {
    expect(normalizeChildName('  \t Sam \n ')).toBe('sam');
  });

  it('collapses runs of spaces far longer than eight', () => {
    expect(normalizeChildName(`Sam${' '.repeat(40)}Smith`)).toBe('sam smith');
  });

  it('treats a tab as the same separator as a space', () => {
    expect(normalizeChildName('Sam\tSmith')).toBe(normalizeChildName('Sam Smith'));
  });

  it('treats a newline as the same separator as a space', () => {
    expect(normalizeChildName('Sam\nSmith')).toBe('sam smith');
  });

  it('keeps genuinely different names apart', () => {
    expect(normalizeChildName('Sam')).not.toBe(normalizeChildName('Samuel'));
  });
});
