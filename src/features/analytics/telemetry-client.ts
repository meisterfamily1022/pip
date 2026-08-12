import Constants from 'expo-constants';
import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { analyticsPreferences } from './analytics-service';
import { parseTelemetryEvent, type TelemetryEventName } from './contracts';

type Queued = { idempotencyKey: string; occurredAt: string; name: TelemetryEventName; payload: Record<string, unknown> };
export interface TelemetryGateway { send(batch: Queued[], pseudonym: string): Promise<void>; }
const gateway: TelemetryGateway = { async send(batch, pseudonym) { const { error } = await (await import('@/lib/supabase')).supabase.rpc('ingest_telemetry', { batch, installation_pseudonym: pseudonym }); if (error) throw error; } };
const MAX_QUEUE = 25;
const KEY = 'pip.analytics.pseudonym.v1';

async function pseudonym(): Promise<string> {
  const fresh = (raw: string | null): string | null => {
    try { const value = JSON.parse(raw ?? '') as { value: string; createdAt: number }; return Date.now() - value.createdAt < 30 * 86400000 ? value.value : null; } catch { return null; }
  };
  const created = { value: crypto.randomUUID() + crypto.randomUUID(), createdAt: Date.now() };
  if (Platform.OS === 'web') {
    const key = fresh(typeof localStorage === 'undefined' ? null : localStorage.getItem(KEY));
    if (key) return key;
    if (typeof localStorage !== 'undefined') localStorage.setItem(KEY, JSON.stringify(created));
    return created.value;
  }
  const current = fresh(await SecureStore.getItemAsync(KEY));
  if (current) return current;
  await SecureStore.setItemAsync(KEY, JSON.stringify(created), { keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY });
  return created.value;
}

export class TelemetryClient {
  private queue: Queued[] = [];
  constructor(private readonly transport: TelemetryGateway = gateway, private readonly consent = analyticsPreferences) {}

  async track(name: TelemetryEventName, values: Record<string, unknown> = {}): Promise<void> {
    try {
      if (!(await this.consent.get()).granted) { this.queue = []; return; }
      const parsed = parseTelemetryEvent({ name, payload: { ...values, appVersion: Constants.expoConfig?.version ?? 'unknown', platform: Platform.OS } });
      this.queue.push({ ...parsed, idempotencyKey: crypto.randomUUID(), occurredAt: new Date().toISOString() });
      if (this.queue.length > MAX_QUEUE) this.queue.shift();
      await this.flush();
    } catch { /* Analytics must never affect the product action. */ }
  }

  async flush(): Promise<void> {
    if (!this.queue.length) return;
    if (!(await this.consent.get()).granted) { this.queue = []; return; }
    const batch = [...this.queue];
    try { await this.transport.send(batch, await pseudonym()); this.queue.splice(0, batch.length); } catch { /* bounded best-effort retry on the next event */ }
  }
}
export const telemetry = new TelemetryClient();
