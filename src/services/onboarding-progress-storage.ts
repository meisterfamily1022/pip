import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

const STARTED_KEY = 'playmap.onboarding-started';
let webStarted = false;

export const onboardingProgressStorage = {
  async getStarted(): Promise<boolean> { return Platform.OS === 'web' ? webStarted : (await SecureStore.getItemAsync(STARTED_KEY)) === '1'; },
  async markStarted(): Promise<void> { if (Platform.OS === 'web') { webStarted = true; } else await SecureStore.setItemAsync(STARTED_KEY, '1'); },
  async clear(): Promise<void> { if (Platform.OS === 'web') { webStarted = false; } else await SecureStore.deleteItemAsync(STARTED_KEY); },
};
