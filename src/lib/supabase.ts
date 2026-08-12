import 'react-native-url-polyfill/auto';
import { AppState, type AppStateStatus, Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { createClient, processLock } from '@supabase/supabase-js';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabasePublishableKey = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

if (!supabaseUrl || !supabasePublishableKey) {
  throw new Error(
    'Supabase is not configured. Set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY.',
  );
}

const SESSION_KEY = 'pip.supabase.auth.session';

/**
 * Supabase storage adapter for native sessions. SecureStore uses the iOS
 * Keychain, so refresh tokens never enter AsyncStorage or the app database.
 */
const secureStoreAdapter = {
  getItem: (key: string) => SecureStore.getItemAsync(key),
  setItem: (key: string, value: string) =>
    SecureStore.setItemAsync(key, value, {
      keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
    }),
  removeItem: (key: string) => SecureStore.deleteItemAsync(key),
};

export const supabase = createClient(supabaseUrl, supabasePublishableKey, {
  auth: {
    storage: secureStoreAdapter,
    storageKey: SESSION_KEY,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
    lock: processLock,
  },
});

// Supabase only refreshes a native session while the app is active. This is
// deliberately module-scoped so importing the client never creates duplicate
// listeners when a screen re-renders.
if (Platform.OS !== 'web') {
  const refreshOnActive = (nextState: AppStateStatus): void => {
    if (nextState === 'active') supabase.auth.startAutoRefresh();
    else supabase.auth.stopAutoRefresh();
  };
  AppState.addEventListener('change', refreshOnActive);
}
