import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

/**
 * Where the parent's session token lives on the device.
 *
 * The token goes to the platform keystore, never to AsyncStorage. On web there
 * is no keystore, so the token is held in memory only: it survives navigation
 * within a session but not a reload, which is the safer trade for a browser and
 * keeps a bearer token out of localStorage where any script could read it.
 */

const SESSION_TOKEN_KEY = 'pip.session-token';

export type AuthSessionStorage = {
  save(token: string): Promise<void>;
  read(): Promise<string | null>;
  clear(): Promise<void>;
};

let inMemoryToken: string | null = null;

export const authSessionStorage: AuthSessionStorage = {
  async save(token: string): Promise<void> {
    if (Platform.OS === 'web') {
      inMemoryToken = token;
      return;
    }
    await SecureStore.setItemAsync(SESSION_TOKEN_KEY, token, {
      keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
    });
  },

  async read(): Promise<string | null> {
    if (Platform.OS === 'web') return inMemoryToken;
    return SecureStore.getItemAsync(SESSION_TOKEN_KEY);
  },

  async clear(): Promise<void> {
    if (Platform.OS === 'web') {
      inMemoryToken = null;
      return;
    }
    await SecureStore.deleteItemAsync(SESSION_TOKEN_KEY);
  },
};

/** Test seam for the web in-memory branch. */
export function resetInMemorySessionTokenForTests(): void {
  inMemoryToken = null;
}
