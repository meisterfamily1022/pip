import 'react-native-url-polyfill/auto';
import { AppState, type AppStateStatus, Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { createClient, processLock } from '@supabase/supabase-js';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabasePublishableKey = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

export const isSupabaseConfigured = Boolean(supabaseUrl && supabasePublishableKey);

const SESSION_KEY = 'pip.supabase.auth.session';

/**
 * Supabase storage adapter for native sessions. SecureStore uses the iOS
 * Keychain, so refresh tokens never enter AsyncStorage or the app database.
 */
const secureStoreAdapter = Platform.OS === 'web'
  ? {
      getItem: async (key: string) => typeof localStorage === 'undefined' ? null : localStorage.getItem(key),
      setItem: async (key: string, value: string) => { if (typeof localStorage !== 'undefined') localStorage.setItem(key, value); },
      removeItem: async (key: string) => { if (typeof localStorage !== 'undefined') localStorage.removeItem(key); },
    }
  : {
      getItem: (key: string) => SecureStore.getItemAsync(key),
      setItem: (key: string, value: string) =>
        SecureStore.setItemAsync(key, value, {
          keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
        }),
      removeItem: (key: string) => SecureStore.deleteItemAsync(key),
    };

// Static rendering imports route modules in a build environment that does not
// carry deploy secrets. A syntactically valid inert endpoint keeps builds and
// local-only use available; authenticated calls still fail closed.
export const supabase = createClient(
  supabaseUrl ?? 'https://unconfigured.invalid',
  supabasePublishableKey ?? 'unconfigured-publishable-key', {
  auth: {
    storage: secureStoreAdapter,
    storageKey: SESSION_KEY,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
    lock: processLock,
  },
  },
);

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
