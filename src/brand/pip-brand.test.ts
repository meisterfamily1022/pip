import appConfig from '../../app.json';

import { pipBrand } from './pip-brand';

describe('Pip customer-facing brand language', () => {
  it('exports the approved product name and campaign lines', () => {
    expect(pipBrand).toEqual({
      name: 'Pip',
      primaryTagline: 'Less deciding. More playing.',
      supportingCampaignLine: 'Less mess. More play.',
    });
  });

  it('uses Pip in Expo display and permission metadata', () => {
    expect(appConfig.expo.name).toBe(pipBrand.name);
    expect(appConfig.expo.description).toBe(pipBrand.primaryTagline);
    expect(JSON.stringify(appConfig.expo.plugins)).not.toContain('PlayMap');
  });

  it('preserves externally significant legacy identifiers', () => {
    expect(appConfig.expo.slug).toBe('playmap-mobile');
    expect(appConfig.expo.scheme).toBe('playmapmobile');
    expect(appConfig.expo.ios.bundleIdentifier).toBe('com.meister23.playmapmobile');
  });
});
