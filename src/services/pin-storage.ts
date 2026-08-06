import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

// Rebrand compatibility: changing this legacy key would orphan existing parent PINs.
const PIN_STORAGE_KEY = 'playmap.parent-pin';

export type PinStorage = {
  savePin(pin: string): Promise<void>;
  getPin(): Promise<string | null>;
  deletePin(): Promise<void>;
};

/**
 * The parent PIN.
 *
 * On device it goes to the platform keystore. On web there is no keystore, so
 * it is held in memory for the session only.
 *
 * It used to go to `localStorage` on web, which meant any script on the page
 * could read the four digits guarding Parent Mode. That mattered little while
 * web was a development target, but `web.output` is now `server` and the app is
 * served publicly alongside the landing page, so the PIN is kept out of storage
 * a script can reach. This mirrors how the account session token is handled.
 *
 * The trade: a browser reload forgets the PIN and setup is required again on
 * web. Child Mode's lock is a soft guard against a child wandering into Parent
 * Mode, not a security boundary, and the native app is the shipping product.
 */
let inMemoryPin: string | null = null;

export const pinStorage: PinStorage = {
  async savePin(pin: string): Promise<void> {
    if (Platform.OS === 'web') {
      inMemoryPin = pin;
      return;
    }
    await SecureStore.setItemAsync(PIN_STORAGE_KEY, pin);
  },
  async getPin(): Promise<string | null> {
    if (Platform.OS === 'web') return inMemoryPin;
    return SecureStore.getItemAsync(PIN_STORAGE_KEY);
  },
  async deletePin(): Promise<void> {
    if (Platform.OS === 'web') {
      inMemoryPin = null;
      return;
    }
    await SecureStore.deleteItemAsync(PIN_STORAGE_KEY);
  },
};

/** Test seam for the web in-memory branch. */
export function resetInMemoryPinForTests(): void {
  inMemoryPin = null;
}
