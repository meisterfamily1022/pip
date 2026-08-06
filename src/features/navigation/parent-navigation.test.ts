import { BULK_TOY_INTAKE_ROUTE, parentBackTargets } from './parent-navigation';

describe('Parent Mode navigation targets', () => {
  it('always gives top-level screens a deterministic Home exit', () => {
    expect(parentBackTargets.toyLibrary).toBe('/parent/home');
    expect(parentBackTargets.locations).toBe('/parent/home');
    expect(parentBackTargets.settings).toBe('/parent/home');
  });

  it('returns forms to their owning Parent Mode collection', () => {
    expect(parentBackTargets.addToy).toBe('/parent/toy-library');
    expect(parentBackTargets.editToy).toBe('/parent/toy-library');
    expect(parentBackTargets.addLocation).toBe('/parent/locations');
    expect(parentBackTargets.editLocation).toBe('/parent/locations');
  });

  it('is stable across repeated navigation requests', () => {
    expect(Array.from({ length: 5 }, () => parentBackTargets.addLocation)).toEqual(Array(5).fill('/parent/locations'));
  });

  it('routes Add More Photos directly into bulk intake', () => {
    expect(BULK_TOY_INTAKE_ROUTE).toBe('/parent/add-toy?mode=bulk');
  });
});
