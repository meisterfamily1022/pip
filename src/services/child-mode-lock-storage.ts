import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

// Rebrand compatibility: changing this legacy key would lose the saved Child Mode lock state.
const CHILD_MODE_LOCK_KEY = 'playmap.child-mode-locked';

export type ChildModeLockStorage = {
  getLocked(): Promise<boolean>;
  setLocked(locked: boolean): Promise<void>;
};

function getWebStorage(): Storage {
  if (typeof window === 'undefined' || !window.sessionStorage) {
    throw new Error('Child Mode access storage is unavailable.');
  }
  return window.sessionStorage;
}

export const childModeLockStorage: ChildModeLockStorage = {
  async getLocked(): Promise<boolean> {
    if (Platform.OS === 'web') return getWebStorage().getItem(CHILD_MODE_LOCK_KEY) === '1';
    return await SecureStore.getItemAsync(CHILD_MODE_LOCK_KEY) === '1';
  },

  async setLocked(locked: boolean): Promise<void> {
    if (Platform.OS === 'web') {
      if (locked) getWebStorage().setItem(CHILD_MODE_LOCK_KEY, '1');
      else getWebStorage().removeItem(CHILD_MODE_LOCK_KEY);
      return;
    }
    if (locked) await SecureStore.setItemAsync(CHILD_MODE_LOCK_KEY, '1');
    else await SecureStore.deleteItemAsync(CHILD_MODE_LOCK_KEY);
  },
};
