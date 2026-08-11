import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

/**
 * Whether Pip asks for the PIN every time, or remembers the parent briefly.
 *
 * Kept beside the PIN in the keystore rather than in SQLite: it is a property of
 * how this device is guarded, not of the household's data, and storing it here
 * means no schema change and nothing new to sync.
 *
 * The "last verified" moment is deliberately not persisted on web, where there
 * is no keystore — a reload there re-asks, which is the safe direction to fail.
 */
const ASK_EVERY_TIME_KEY = 'playmap.parent-ask-every-time';

export type ParentAccessPreferences = {
  getAskEveryTime(): Promise<boolean>;
  setAskEveryTime(value: boolean): Promise<void>;
  /** Epoch milliseconds of the last correct PIN this launch, if any. */
  getLastVerifiedAt(): number | null;
  markVerified(now: number): void;
  forgetVerification(): void;
};

let lastVerifiedAt: number | null = null;

export const parentAccessPreferences: ParentAccessPreferences = {
  async getAskEveryTime(): Promise<boolean> {
    if (Platform.OS === 'web') return true;
    try {
      // Absent means "not chosen yet". The calmer default is to remember, which
      // is what the design describes; a parent who wants stricter can say so.
      return (await SecureStore.getItemAsync(ASK_EVERY_TIME_KEY)) === '1';
    } catch {
      return true;
    }
  },

  async setAskEveryTime(value: boolean): Promise<void> {
    if (Platform.OS === 'web') return;
    if (value) await SecureStore.setItemAsync(ASK_EVERY_TIME_KEY, '1');
    else await SecureStore.deleteItemAsync(ASK_EVERY_TIME_KEY);
    lastVerifiedAt = null;
  },

  getLastVerifiedAt: () => lastVerifiedAt,
  markVerified: (now: number) => { lastVerifiedAt = now; },
  forgetVerification: () => { lastVerifiedAt = null; },
};
