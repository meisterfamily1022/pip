import { countLabel, displayChildName, displayToyName, presentLocation } from './presentation';

describe('display presentation', () => {
  it('repairs accidental lowercase child names and preserves intentional mixed case', () => {
    expect(displayChildName('  billy   bob ')).toBe('Billy Bob');
    expect(displayChildName("o'connor-smith")).toBe("O'Connor-Smith");
    expect(displayChildName('McKay')).toBe('McKay');
    expect(displayChildName('iZzy')).toBe('iZzy');
    expect(displayChildName('')).toBe('Your child');
  });

  it('keeps the full canonical toy name while cleaning whitespace', () => {
    expect(displayToyName('  Magnetic   building set  ')).toBe('Magnetic building set');
    expect(displayToyName(null)).toBe('This toy');
  });

  it.each([
    ['Playroom', 'Blue bin', 'Playroom · Blue bin', 'Blue bin, in Playroom'],
    ['Playroom', null, 'Playroom', 'In Playroom'],
    [null, 'Blue bin', 'Blue bin', 'Blue bin'],
    ['  ', '', null, 'Ask a grown-up where it lives.'],
  ])('formats complete and partial locations', (room, spot, compact, instruction) => {
    expect(presentLocation(room, spot)).toMatchObject({ compact, instruction });
  });

  it('formats singular and plural counts', () => {
    expect(countLabel(1, 'toy')).toBe('1 toy');
    expect(countLabel(2, 'toy')).toBe('2 toys');
    expect(countLabel(0, 'child', 'children')).toBe('0 children');
  });
});
