import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

/**
 * When a sign-in code was last sent, and how many have been sent to this
 * address.
 *
 * The cooldown lives here rather than in the confirm screen's state because the
 * *first* code is not requested on that screen — it is requested on sign-in or
 * sign-up, and the screen is then pushed. Screen-local state starts at "nothing
 * sent yet", so the one press most likely to hit the server's per-address limit
 * — pressing Send another code straight away, having just been sent one — was
 * the one press the countdown did not cover.
 *
 * The attempt count is persisted for the same reason: the guidance that stops
 * promising another code will help is only honest if it counts every code sent
 * to this address, not only the ones sent from the screen currently mounted.
 *
 * Recorded only after the server accepts a send. A send that failed did not
 * consume the parent's allowance and must not start a cooldown.
 */

const SEND_LOG_KEY = 'pip.otp-send-log';

export type OtpSendRecord = { email: string; sentAt: number; attempts: number };

let inMemory: OtpSendRecord | null = null;

async function read(): Promise<OtpSendRecord | null> {
  if (Platform.OS === 'web') return inMemory;
  const raw = await SecureStore.getItemAsync(SEND_LOG_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<OtpSendRecord>;
    if (typeof parsed.email !== 'string' || typeof parsed.sentAt !== 'number') return null;
    return { email: parsed.email, sentAt: parsed.sentAt, attempts: Number(parsed.attempts) || 1 };
  } catch {
    // A malformed record is not worth failing sign-in over; treat it as none.
    return null;
  }
}

async function write(record: OtpSendRecord | null): Promise<void> {
  if (Platform.OS === 'web') { inMemory = record; return; }
  if (record === null) { await SecureStore.deleteItemAsync(SEND_LOG_KEY); return; }
  await SecureStore.setItemAsync(SEND_LOG_KEY, JSON.stringify(record));
}

export const otpSendLog = {
  /** Counts a send the server accepted. Switching address restarts the count. */
  async record(email: string, now: number = Date.now()): Promise<OtpSendRecord> {
    const previous = await read();
    const attempts = previous && previous.email === email ? previous.attempts + 1 : 1;
    const next: OtpSendRecord = { email, sentAt: now, attempts };
    await write(next);
    return next;
  },

  /** What has been sent to this address, or null if nothing has. */
  async forEmail(email: string): Promise<OtpSendRecord | null> {
    const record = await read();
    return record && record.email === email ? record : null;
  },

  async clear(): Promise<void> {
    await write(null);
  },
};
