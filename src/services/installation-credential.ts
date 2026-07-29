import * as SecureStore from 'expo-secure-store';

const KEY = 'playmap.ai.installation-credential.v1';
let memoryCredential: string | null = null;
const isWeb = typeof document !== 'undefined';
const webKey = '__playmapAiInstallationCredential';

export interface InstallationCredentialClient { get(): Promise<string | null>; save(value: string): Promise<void>; clear(): Promise<void>; }
export class ExpoInstallationCredentialClient implements InstallationCredentialClient {
  async get() { if (isWeb) return memoryCredential; return SecureStore.getItemAsync(KEY); }
  async save(value: string) { if (isWeb) { memoryCredential = value; return; } await SecureStore.setItemAsync(KEY, value, { keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY }); }
  async clear() { if (isWeb) { memoryCredential = null; return; } await SecureStore.deleteItemAsync(KEY); }
}
export async function getOrIssueInstallationCredential(fetcher: typeof fetch = fetch, client: InstallationCredentialClient = new ExpoInstallationCredentialClient()): Promise<string | null> {
  const current = await client.get(); if (current) return current;
  try { const response = await fetcher('/v1/installations', { method: 'POST', headers: { accept: 'application/json' } }); if (!response.ok) return null; const body = await response.json() as { installationToken?: unknown }; if (typeof body.installationToken !== 'string') return null; await client.save(body.installationToken); return body.installationToken; } catch { return null; }
}
export const installationCredentialStorageKey = isWeb ? webKey : KEY;
