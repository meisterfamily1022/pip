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
  if (Platform.OS === 'web') {
    const key = typeof localStorage === 'undefined' ? null : localStorage.getItem(KEY);
    if (key) return key;
    const created = crypto.randomUUID() + crypto.randomUUID();
    if (typeof localStorage !== 'undefined') localStorage.setItem(KEY, created);
    return created;
  }
  const current = await SecureStore.getItemAsync(KEY);
  if (current) return current;
  const created = crypto.randomUUID() + crypto.randomUUID();
  await SecureStore.setItemAsync(KEY, created, { keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY });
  return created;
}

export class TelemetryClient {
  private queue: Queued[] = [];
  constructor(private readonly transport: TelemetryGateway = gateway, private readonly consent = analyticsPreferences) {}

  async track(name: TelemetryEventName, values: Record<string, unknown> = {}): Promise<void> {
    try {
      if (!(await this.consent.get()).granted) return;
      const parsed = parseTelemetryEvent({ name, payload: { ...values, appVersion: Constants.expoConfig?.version ?? 'unknown', platform: Platform.OS } });
      this.queue.push({ ...parsed, idempotencyKey: crypto.randomUUID(), occurredAt: new Date().toISOString() });
      if (this.queue.length > MAX_QUEUE) this.queue.shift();
      await this.flush();
    } catch { /* Analytics must never affect the product action. */ }
  }

  async flush(): Promise<void> {
    if (!this.queue.length) return;
    const batch = [...this.queue];
    try { await this.transport.send(batch, await pseudonym()); this.queue.splice(0, batch.length); } catch { /* bounded best-effort retry on the next event */ }
  }
}
export const telemetry = new TelemetryClient();

