import { getOrIssueInstallationCredential, type InstallationCredentialClient } from './installation-credential';

class MemoryClient implements InstallationCredentialClient { value: string | null = null; async get() { return this.value; } async save(value: string) { this.value = value; } async clear() { this.value = null; } }
describe('installation credential client', () => {
  it('stores server-issued credentials without touching app SQLite', async () => { const client = new MemoryClient(); const fetcher = jest.fn(async () => new Response(JSON.stringify({ installationToken: 'server-token' }), { status: 201 })); await expect(getOrIssueInstallationCredential(fetcher, client)).resolves.toBe('server-token'); expect(fetcher).toHaveBeenCalledTimes(1); await expect(getOrIssueInstallationCredential(fetcher, client)).resolves.toBe('server-token'); expect(fetcher).toHaveBeenCalledTimes(1); });
  it('preserves manual flow when issuance fails and clears invalid credentials', async () => { const client = new MemoryClient(); await expect(getOrIssueInstallationCredential(jest.fn(async () => new Response('{}', { status: 503 })), client)).resolves.toBeNull(); await client.save('invalid'); await client.clear(); await expect(client.get()).resolves.toBeNull(); });
});
