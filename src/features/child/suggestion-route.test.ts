import { childSuggestionLimit } from '@/app/(child)/child/toy-suggestions';

describe('child suggestion route integration', () => {
  it('uses exactly one toy for Surprise Me regardless of parent choice limit', () => {
    expect(childSuggestionLimit(1, true)).toBe(1);
    expect(childSuggestionLimit(3, true)).toBe(1);
    expect(childSuggestionLimit(5, true)).toBe(1);
  });

  it('uses the parent choice limit for normal suggestions', () => {
    expect(childSuggestionLimit(1, false)).toBe(1);
    expect(childSuggestionLimit(3, false)).toBe(3);
    expect(childSuggestionLimit(5, false)).toBe(5);
    expect(childSuggestionLimit(99, false)).toBe(3);
  });
});
