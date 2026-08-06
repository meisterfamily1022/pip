import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

// Rebrand compatibility: changing this legacy key would orphan existing parent PINs.
const PIN_STORAGE_KEY = 'playmap.parent-pin';

export type PinStorage = {
  savePin(pin: string): Promise<void>;
  getPin(): Promise<string | null>;
  deletePin(): Promise<void>;
};

function getWebStorage(): Storage {
  if (typeof window === 'undefined' || !window.localStorage) {
    throw new Error('Web PIN storage is unavailable.');
  }
  return window.localStorage;
}

export const pinStorage: PinStorage = {
  async savePin(pin: string): Promise<void> {
    if (Platform.OS === 'web') {
      getWebStorage().setItem(PIN_STORAGE_KEY, pin);
      return;
    }
    await SecureStore.setItemAsync(PIN_STORAGE_KEY, pin);
  },
  async getPin(): Promise<string | null> {
    if (Platform.OS === 'web') {
      return getWebStorage().getItem(PIN_STORAGE_KEY);
    }
    return SecureStore.getItemAsync(PIN_STORAGE_KEY);
  },
  async deletePin(): Promise<void> {
    if (Platform.OS === 'web') {
      getWebStorage().removeItem(PIN_STORAGE_KEY);
      return;
    }
    await SecureStore.deleteItemAsync(PIN_STORAGE_KEY);
  },
};
