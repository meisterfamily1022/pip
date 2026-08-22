import { collapseWhitespace, normalizeChildName } from './child-name';

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

describe('the stored form of a name', () => {
  it('collapses a run of spaces so a name cannot render as a gap', () => {
    expect(collapseWhitespace(`Sam${' '.repeat(12)}Smith`)).toBe('Sam Smith');
  });

  it('keeps the parent\'s capitalisation', () => {
    expect(collapseWhitespace('  saM   SMITH ')).toBe('saM SMITH');
  });

  it('agrees with the rule the unique index uses', () => {
    const typed = 'Sam\t\t Smith  ';
    expect(normalizeChildName(collapseWhitespace(typed))).toBe(normalizeChildName(typed));
  });
});
