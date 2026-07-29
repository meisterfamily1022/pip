import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

import type { ToyAnalysisRequest, ToyAnalysisResponse } from './contracts';
import { MAX_IMAGE_BYTES } from './contracts';

export type InstallationStatus = 'active' | 'revoked';
export type RequestStatus = 'reserved' | 'succeeded' | 'failed';
export type UsageEventType = 'request_received' | 'request_rejected' | 'provider_started' | 'provider_succeeded' | 'provider_failed' | 'cache_hit' | 'quota_exhausted' | 'global_limit_reached';

export type InstallationRecord = { installationId: string; createdAt: string; lastSeenAt: string; status: InstallationStatus; credentialVersion: number; betaAllowance: number; betaUsed: number; lifetimeSuccessfulAnalyses: number; monthlySuccessfulAnalyses: number; monthlyPeriodKey: string };
export type IdempotencyRecord = { requestId: string; installationId: string; requestFingerprint: string; status: RequestStatus; response?: ToyAnalysisResponse; errorCode?: string; createdAt: string; completedAt?: string; expiresAt: string };
export type CacheRecord = { installationId: string; fingerprint: string; response: ToyAnalysisResponse; expiresAt: string };
export type UsageEvent = { eventId: string; requestId: string; installationId: string; eventType: UsageEventType; provider: string; cached: boolean; success: boolean; errorCode?: string; estimatedCostMicros: number; createdAt: string };
export type GlobalBudget = { aiEnabled: boolean; emergencyDisabled: boolean; maintenanceMessage?: string; maxImageBytes: number; monthlySuccessfulLimit: number; monthlyCostCapMicros: number; monthlyPeriodKey: string; monthlySuccessfulAnalyses: number; monthlyEstimatedCostMicros: number };

export interface SystemClock { now(): Date }
export interface InstallationCredentialRepository { create(record: InstallationRecord): Promise<void>; get(id: string): Promise<InstallationRecord | undefined>; update(record: InstallationRecord): Promise<void> }
export interface QuotaRepository { get(id: string): Promise<InstallationRecord | undefined>; reserve(id: string, period: string): Promise<'reserved' | 'exhausted' | 'revoked'>; settleSuccess(id: string, period: string): Promise<void>; release(id: string): Promise<void> }
export interface IdempotencyRepository { get(requestId: string): Promise<IdempotencyRecord | undefined>; create(record: IdempotencyRecord): Promise<boolean>; complete(requestId: string, update: Pick<IdempotencyRecord, 'status' | 'response' | 'errorCode' | 'completedAt'>): Promise<void>; cleanExpired(now: string): Promise<void> }
export interface AnalysisResultCache { get(installationId: string, fingerprint: string, now: string): Promise<ToyAnalysisResponse | undefined>; set(record: CacheRecord): Promise<void> }
export interface GlobalBudgetRepository { get(period: string): Promise<GlobalBudget>; update(budget: GlobalBudget): Promise<void> }
export interface UsageEventRepository { append(event: UsageEvent): Promise<void>; list(): Promise<UsageEvent[]> }

export type DurableState = { installations: Map<string, InstallationRecord>; idempotency: Map<string, IdempotencyRecord>; cache: Map<string, CacheRecord>; events: UsageEvent[]; budget: GlobalBudget };
const globalKey = '__playmapDurableAiState';
function state(): DurableState {
  const root = globalThis as typeof globalThis & { [globalKey]?: DurableState };
  if (!root[globalKey]) root[globalKey] = { installations: new Map(), idempotency: new Map(), cache: new Map(), events: [], budget: { aiEnabled: true, emergencyDisabled: false, maxImageBytes: MAX_IMAGE_BYTES, monthlySuccessfulLimit: 1000, monthlyCostCapMicros: 10_000_000_000, monthlyPeriodKey: '', monthlySuccessfulAnalyses: 0, monthlyEstimatedCostMicros: 0 } };
  return root[globalKey]!;
}
export function resetLocalDevelopmentStorageForTests() { const root = globalThis as typeof globalThis & { [globalKey]?: DurableState }; delete root[globalKey]; }
export class LocalDevelopmentStorage {
  readonly data = state();
  private readonly reservations = new Set<string>();
  readonly installations: InstallationCredentialRepository = { create: async (r) => { this.data.installations.set(r.installationId, { ...r }); }, get: async (id) => this.data.installations.get(id), update: async (r) => { this.data.installations.set(r.installationId, { ...r }); } };
  readonly quota: QuotaRepository = { get: async (id) => this.data.installations.get(id), reserve: async (id, period) => { const r = this.data.installations.get(id); if (!r || r.status === 'revoked') return 'revoked'; if (r.monthlyPeriodKey !== period) { r.monthlyPeriodKey = period; r.monthlySuccessfulAnalyses = 0; } if (r.betaUsed + (this.reservations.has(id) ? 1 : 0) >= r.betaAllowance) return 'exhausted'; this.reservations.add(id); return 'reserved'; }, settleSuccess: async (id, period) => { const r = this.data.installations.get(id); if (!r) throw new Error('missing installation'); if (r.monthlyPeriodKey !== period) { r.monthlyPeriodKey = period; r.monthlySuccessfulAnalyses = 0; } r.betaUsed += 1; r.lifetimeSuccessfulAnalyses += 1; r.monthlySuccessfulAnalyses += 1; this.reservations.delete(id); }, release: async (id) => { this.reservations.delete(id); } };
  readonly idempotency: IdempotencyRepository = { get: async (id) => { const r = this.data.idempotency.get(id); return r && r.expiresAt > new Date().toISOString() ? r : undefined; }, create: async (r) => { if (this.data.idempotency.has(r.requestId)) return false; this.data.idempotency.set(r.requestId, { ...r }); return true; }, complete: async (id, update) => { const r = this.data.idempotency.get(id); if (r) this.data.idempotency.set(id, { ...r, ...update }); }, cleanExpired: async (now) => { for (const [k, r] of this.data.idempotency) if (r.expiresAt <= now) this.data.idempotency.delete(k); } };
  readonly cache: AnalysisResultCache = { get: async (installationId, fp, now) => { const r = this.data.cache.get(`${installationId}:${fp}`); return r && r.expiresAt > now ? r.response : undefined; }, set: async (r) => { this.data.cache.set(`${r.installationId}:${r.fingerprint}`, { ...r }); } };
  readonly budget: GlobalBudgetRepository = { get: async (period) => { const b = this.data.budget; if (b.monthlyPeriodKey !== period) Object.assign(b, { monthlyPeriodKey: period, monthlySuccessfulAnalyses: 0, monthlyEstimatedCostMicros: 0 }); return { ...b }; }, update: async (b) => { this.data.budget = { ...b }; } };
  readonly events: UsageEventRepository = { append: async (e) => { this.data.events.push({ ...e }); }, list: async () => [...this.data.events] };
}

export interface CredentialSigner { issue(installationId: string, issuedAt: string, version?: number): string; verify(token: string): { installationId: string; issuedAt: string; version: number } | undefined }
export class HmacInstallationCredentialSigner implements CredentialSigner {
  constructor(private readonly secret: string, private readonly now: SystemClock = { now: () => new Date() }) { if (!secret) throw new Error('Signing secret is required'); }
  issue(installationId: string, issuedAt: string, version = 1) { const payload = b64(JSON.stringify({ v: version, i: installationId, t: issuedAt })); return `inst_${payload}.${sign(payload, this.secret)}`; }
  verify(token: string) { if (token.length > 1024 || !token.startsWith('inst_')) return undefined; const encoded = token.slice(5); const separator = encoded.indexOf('.'); if (separator < 1) return undefined; const payload = encoded.slice(0, separator); const signature = encoded.slice(separator + 1); const expected = sign(payload, this.secret); if (!safeEqual(signature, expected)) return undefined; try { const value = JSON.parse(unb64(payload)) as { v?: number; i?: string; t?: string }; if (value.v !== 1 || typeof value.i !== 'string' || !/^ins_[A-Za-z0-9-]{16,64}$/.test(value.i) || typeof value.t !== 'string') return undefined; if (this.now.now().getTime() - new Date(value.t).getTime() > 366 * 24 * 60 * 60 * 1000) return undefined; return { installationId: value.i, issuedAt: value.t, version: value.v }; } catch { return undefined; } }
}
function b64(value: string) { return Buffer.from(value).toString('base64url'); }
function unb64(value: string) { return Buffer.from(value, 'base64url').toString('utf8'); }
function sign(value: string, secret: string) { return createHmac('sha256', secret).update(value).digest('base64url'); }
function safeEqual(left: string, right: string) { const a = Buffer.from(left); const b = Buffer.from(right); return a.length === b.length && timingSafeEqual(a, b); }
export function newInstallationId() { return `ins_${randomBytes(24).toString('hex')}`; }
export function fingerprint(request: ToyAnalysisRequest) { return createHash('sha256').update(JSON.stringify({ mediaType: request.image.mediaType, byteLength: request.image.byteLength, mockReference: request.image.mockReference ?? '' })).digest('hex'); }
export function periodKey(date: Date) { return date.toISOString().slice(0, 7); }
export type CostEstimate = { estimatedInputCostMicros: number; estimatedOutputCostMicros: number; estimatedTotalCostMicros: number; actualCostMicros: number };
export interface CostEstimator { estimate(input: ToyAnalysisRequest): CostEstimate }
export class MockCostEstimator implements CostEstimator { constructor(private readonly estimatedTotalCostMicros = 0) {} estimate() { return { estimatedInputCostMicros: this.estimatedTotalCostMicros, estimatedOutputCostMicros: 0, estimatedTotalCostMicros: this.estimatedTotalCostMicros, actualCostMicros: 0 }; } }
export function summarize(events: UsageEvent[], budget: GlobalBudget) { return { installationsCreated: new Set(events.map((event) => event.installationId)).size, successfulAnalyses: events.filter((event) => event.eventType === 'provider_succeeded').length, failedAttempts: events.filter((event) => event.eventType === 'provider_failed').length, cacheHits: events.filter((event) => event.eventType === 'cache_hit').length, quotaRejections: events.filter((event) => event.eventType === 'quota_exhausted').length, globalLimitRejections: events.filter((event) => event.eventType === 'global_limit_reached').length, estimatedMonthlyCostMicros: budget.monthlyEstimatedCostMicros, aiEnabled: budget.aiEnabled && !budget.emergencyDisabled }; }
