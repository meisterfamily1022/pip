import { z } from 'zod';
import { AiApplicationError } from './errors';
import { MockToyAnalysisProvider } from './mock-provider';
import { ProviderTimeoutError, ProviderUnavailableError, type ToyAnalysisProvider } from './provider';
import { providerResponseSchema, toyAnalysisRequestSchema, type ToyAnalysisRequest, type ToyAnalysisResponse } from './contracts';
import { HmacInstallationCredentialSigner, LocalDevelopmentStorage, MockCostEstimator, fingerprint, periodKey, type CostEstimator } from './durable-control';

const ZERO_REQUEST_ID = '00000000-0000-4000-8000-000000000000';
const now = () => new Date();

export class DurableToyAnalysisService {
  private readonly inflight = new Map<string, Promise<ToyAnalysisResponse>>();
  constructor(private readonly provider: ToyAnalysisProvider = new MockToyAnalysisProvider(), private readonly storage = new LocalDevelopmentStorage(), private readonly signer = new HmacInstallationCredentialSigner(getSigningSecret()), private readonly estimator: CostEstimator = new MockCostEstimator()) {}
  async analyze(input: unknown): Promise<ToyAnalysisResponse> {
    const requestId = this.requestId(input);
    const parsed = toyAnalysisRequestSchema.safeParse(input);
    if (!parsed.success) throw this.validation(parsed.error, requestId);
    const request = parsed.data as ToyAnalysisRequest;
    const credential = this.signer.verify(request.installationToken);
    if (!credential) throw new AiApplicationError('INVALID_INSTALLATION_CREDENTIAL', requestId);
    const installation = await this.storage.installations.get(credential.installationId);
    if (!installation || installation.status === 'revoked') throw new AiApplicationError('INSTALLATION_REVOKED', requestId);
    const prior = await this.storage.idempotency.get(requestId);
    const fp = fingerprint(request);
    if (prior) { if (prior.installationId !== credential.installationId || prior.requestFingerprint !== fp) throw new AiApplicationError('REQUEST_ID_REUSED', requestId); if (prior.response) return prior.response; }
    const cached = await this.storage.cache.get(credential.installationId, fp, now().toISOString());
    if (cached) { await this.storage.events.append({ eventId: crypto.randomUUID(), requestId, installationId: credential.installationId, eventType: 'cache_hit', provider: 'mock', cached: true, success: true, estimatedCostMicros: 0, createdAt: now().toISOString() }); return { ...cached, requestId }; }
    const existing = this.inflight.get(requestId); if (existing) return existing;
    const work = this.run(request, requestId, credential.installationId, fp); this.inflight.set(requestId, work);
    try { return await work; } finally { this.inflight.delete(requestId); }
  }
  private async run(request: ToyAnalysisRequest, requestId: string, installationId: string, fp: string) {
    const period = periodKey(now()); const budget = await this.storage.budget.get(period);
    if (!budget.aiEnabled || budget.emergencyDisabled) throw new AiApplicationError('AI_DISABLED', requestId);
    if (request.image.byteLength > budget.maxImageBytes) throw new AiApplicationError('IMAGE_TOO_LARGE', requestId);
    const estimate = this.estimator.estimate(request);
    if (budget.monthlySuccessfulAnalyses >= budget.monthlySuccessfulLimit) { await this.event('global_limit_reached', requestId, installationId, false); throw new AiApplicationError('GLOBAL_LIMIT_REACHED', requestId); }
    if (budget.monthlyEstimatedCostMicros + estimate.estimatedTotalCostMicros > budget.monthlyCostCapMicros) { throw new AiApplicationError('GLOBAL_BUDGET_REACHED', requestId); }
    const reserved = await this.storage.quota.reserve(installationId, period);
    if (reserved === 'revoked') throw new AiApplicationError('INSTALLATION_REVOKED', requestId);
    if (reserved === 'exhausted') { await this.event('quota_exhausted', requestId, installationId, false); throw new AiApplicationError('ALLOWANCE_EXHAUSTED', requestId); }
    const created = await this.storage.idempotency.create({ requestId, installationId, requestFingerprint: fp, status: 'reserved', createdAt: now().toISOString(), expiresAt: new Date(now().getTime() + 30 * 60_000).toISOString() });
    if (!created) { await this.storage.quota.release(installationId); const existing = await this.storage.idempotency.get(requestId); if (existing?.response) return existing.response; throw new AiApplicationError('RATE_LIMITED', requestId); }
    await this.event('provider_started', requestId, installationId, false, estimate.estimatedTotalCostMicros);
    try {
      const raw = await this.provider.analyze({ ...request.image }); const parsed = providerResponseSchema.safeParse(raw); if (!parsed.success) throw new AiApplicationError('INVALID_PROVIDER_RESPONSE', requestId);
      const result = { ...normalize(parsed.data), requestId }; await this.storage.quota.settleSuccess(installationId, period);
      budget.monthlySuccessfulAnalyses += 1; budget.monthlyEstimatedCostMicros += estimate.estimatedTotalCostMicros; await this.storage.budget.update(budget);
      await this.storage.idempotency.complete(requestId, { status: 'succeeded', response: result, completedAt: now().toISOString() }); await this.storage.cache.set({ installationId, fingerprint: fp, response: result, expiresAt: new Date(now().getTime() + 30 * 24 * 60 * 60_000).toISOString() }); await this.event('provider_succeeded', requestId, installationId, false, estimate.estimatedTotalCostMicros); return result;
    } catch (error) { await this.storage.quota.release(installationId); const safe = error instanceof AiApplicationError ? error : error instanceof ProviderTimeoutError ? new AiApplicationError('PROVIDER_TIMEOUT', requestId) : error instanceof ProviderUnavailableError ? new AiApplicationError('PROVIDER_UNAVAILABLE', requestId) : new AiApplicationError('PROVIDER_UNAVAILABLE', requestId); await this.storage.idempotency.complete(requestId, { status: 'failed', errorCode: safe.code, completedAt: now().toISOString() }); await this.event('provider_failed', requestId, installationId, false, estimate.estimatedTotalCostMicros, safe.code); throw safe; }
  }
  private async event(eventType: 'global_limit_reached' | 'quota_exhausted' | 'provider_started' | 'provider_succeeded' | 'provider_failed' | 'cache_hit', requestId: string, installationId: string, cached: boolean, estimatedCostMicros = 0, errorCode?: string) { await this.storage.events.append({ eventId: crypto.randomUUID(), requestId, installationId, eventType, provider: 'mock', cached, success: eventType === 'provider_succeeded' || eventType === 'cache_hit', estimatedCostMicros, errorCode, createdAt: now().toISOString() }); }
  private requestId(input: unknown) { const value = typeof input === 'object' && input !== null && 'requestId' in input ? (input as { requestId?: unknown }).requestId : undefined; return typeof value === 'string' && z.string().uuid().safeParse(value).success ? value : ZERO_REQUEST_ID; }
  private validation(error: z.ZodError, requestId: string) { const issue = error.issues[0]; if (issue?.path.join('.') === 'image.byteLength' && issue.code === 'too_big') return new AiApplicationError('IMAGE_TOO_LARGE', requestId); if (issue?.path.join('.') === 'image.mediaType') return new AiApplicationError('UNSUPPORTED_IMAGE_TYPE', requestId); return new AiApplicationError('INVALID_REQUEST', requestId); }
}
function normalize(value: z.infer<typeof providerResponseSchema>) { return { ...value, suggestedName: value.suggestedName?.trim() ?? null, suggestedCategories: [...new Set(value.suggestedCategories)], warnings: [...new Set(value.warnings)] }; }
function getSigningSecret() { const value = (globalThis as typeof globalThis & { process?: { env?: Record<string, string | undefined> } }).process?.env?.PLAYMAP_INSTALLATION_SIGNING_SECRET; if (!value && process.env.NODE_ENV !== 'test') throw new Error('PLAYMAP_INSTALLATION_SIGNING_SECRET is required outside tests'); return value ?? 'test-only-playmap-installation-secret'; }
