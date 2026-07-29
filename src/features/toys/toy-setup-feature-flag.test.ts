import { toySetupFeatureFlags } from './toy-setup-feature-flag';

it('keeps AI toy setup disabled by default', () => {
  expect(toySetupFeatureFlags.aiToySetupEnabled).toBe(false);
});
