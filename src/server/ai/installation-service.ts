import { HmacInstallationCredentialSigner, LocalDevelopmentStorage, newInstallationId } from './durable-control';

const secret = () => (globalThis as typeof globalThis & { process?: { env?: Record<string, string | undefined> } }).process?.env?.PLAYMAP_INSTALLATION_SIGNING_SECRET ?? 'test-only-playmap-installation-secret';
export const defaultInstallationStorage = new LocalDevelopmentStorage();
export const defaultInstallationSigner = new HmacInstallationCredentialSigner(secret());
export async function issueInstallationCredential() {
  const createdAt = new Date().toISOString(); const installationId = newInstallationId();
  await defaultInstallationStorage.installations.create({ installationId, createdAt, lastSeenAt: createdAt, status: 'active', credentialVersion: 1, betaAllowance: 10, betaUsed: 0, lifetimeSuccessfulAnalyses: 0, monthlySuccessfulAnalyses: 0, monthlyPeriodKey: createdAt.slice(0, 7) });
  return { installationToken: defaultInstallationSigner.issue(installationId, createdAt), credentialVersion: 1, issuedAt: createdAt };
}
