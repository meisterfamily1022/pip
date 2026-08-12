import appConfig from '../../../app.json';

describe('iOS development client interaction safety', () => {
  it('does not install Expo Dev Menu’s floating tools window above Pip', () => {
    const plugin = appConfig.expo.plugins.find((entry) => Array.isArray(entry) && entry[0] === 'expo-dev-client') as
      | ['expo-dev-client', { ios?: { toolsButton?: boolean } }]
      | undefined;

    expect(plugin?.[1].ios?.toolsButton).toBe(false);
  });
});
