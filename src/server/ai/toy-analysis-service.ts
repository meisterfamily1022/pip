import { z } from 'zod';
import { AiApplicationError } from './errors';
import { LocalInstallationTokenVerifier, type InstallationTokenVerifier } from './installation-token';
import { MockToyAnalysisProvider } from './mock-provider';
import { ProviderTimeoutError, ProviderUnavailableError, type ToyAnalysisProvider } from './provider';
import { InMemoryUsageQuota, type UsageQuota } from './quota';
import {
  MAX_CATEGORIES,
  providerResponseSchema,
  toyAnalysisRequestSchema,
  type ProviderResponse,
  type ToyAnalysisRequest,
  type ToyAnalysisResponse,
} from './contracts';

function requestId(): string {
  if (typeof globalThis.crypto?.randomUUID === 'function') return globalThis.crypto.randomUUID();
  const randomHex = () => Math.floor(Math.random() * 16).toString(16);
  const section = (length: number) => Array.from({ length }, randomHex).join('');
  return `${section(8)}-${section(4)}-4${section(3)}-8${section(3)}-${section(12)}`;
}

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function dedupe<T>(values: T[]): T[] {
  return [...new Set(values)];
}

export class ToyAnalysisService {
  constructor(
    private readonly provider: ToyAnalysisProvider = new MockToyAnalysisProvider(),
    private readonly quota: UsageQuota = new InMemoryUsageQuota(),
    private readonly tokenVerifier: InstallationTokenVerifier = new LocalInstallationTokenVerifier(),
  ) {}

  async analyze(input: unknown): Promise<ToyAnalysisResponse> {
    const suppliedRequestId = typeof input === 'object' && input !== null && 'requestId' in input
      && typeof input.requestId === 'string' ? input.requestId : undefined;
    const requestIdFromInput = suppliedRequestId && isUuid(suppliedRequestId) ? suppliedRequestId : requestId();
    const parsed = toyAnalysisRequestSchema.safeParse(input);
    if (!parsed.success) throw requestValidationError(parsed.error, requestIdFromInput);

    const request = parsed.data as ToyAnalysisRequest;
    const currentRequestId = request.requestId ?? requestId();
    const reservation = { installationToken: request.installationToken, requestId: currentRequestId };
    if (!(await this.tokenVerifier.verify(request.installationToken))) {
      throw new AiApplicationError('INVALID_REQUEST', currentRequestId);
    }

    const priorResult = this.quota.getResult(reservation);
    if (priorResult) return priorResult;

    const reservationState = await this.quota.reserve(reservation);
    if (reservationState === 'duplicate') {
      const result = this.quota.getResult(reservation);
      if (result) return result;
      throw new AiApplicationError('RATE_LIMITED', currentRequestId);
    }
    if (reservationState === 'exhausted') throw new AiApplicationError('ALLOWANCE_EXHAUSTED', currentRequestId);

    let raw: unknown;
    try {
      raw = await this.provider.analyze({ ...request.image });
    } catch (error) {
      await this.quota.failAfterProvider(reservation);
      if (error instanceof ProviderTimeoutError) throw new AiApplicationError('PROVIDER_TIMEOUT', currentRequestId);
      if (error instanceof ProviderUnavailableError) throw new AiApplicationError('PROVIDER_UNAVAILABLE', currentRequestId);
      throw new AiApplicationError('PROVIDER_UNAVAILABLE', currentRequestId);
    }

    const providerResult = providerResponseSchema.safeParse(raw);
    if (!providerResult.success) {
      await this.quota.failAfterProvider(reservation);
      throw new AiApplicationError('INVALID_PROVIDER_RESPONSE', currentRequestId);
    }

    const normalized = normalizeProviderResponse(providerResult.data);
    const result = { ...normalized, requestId: currentRequestId };
    await this.quota.complete(reservation, result);
    return result;
  }
}

function requestValidationError(error: z.ZodError, requestId: string): AiApplicationError {
  const issue = error.issues[0];
  if (issue?.path[0] === 'image' && issue.path.length === 1 && issue.code === 'invalid_type') {
    return new AiApplicationError('IMAGE_REQUIRED', requestId);
  }
  if (issue?.path.join('.') === 'image.mediaType') return new AiApplicationError('UNSUPPORTED_IMAGE_TYPE', requestId);
  if (issue?.path.join('.') === 'image.byteLength' && issue.code === 'too_big') {
    return new AiApplicationError('IMAGE_TOO_LARGE', requestId);
  }
  return new AiApplicationError('INVALID_REQUEST', requestId);
}

function normalizeProviderResponse(value: ProviderResponse): Omit<ToyAnalysisResponse, 'requestId'> {
  const suggestedName = value.suggestedName?.trim() ?? null;
  if (suggestedName && !z.string().regex(/^[^\u0000-\u001F\u007F<>]{1,80}$/).safeParse(suggestedName).success) {
    throw new AiApplicationError('INVALID_PROVIDER_RESPONSE', '00000000-0000-4000-8000-000000000000');
  }
  return {
    suggestedName,
    suggestedCategories: dedupe(value.suggestedCategories).slice(0, MAX_CATEGORIES),
    suggestedCleanupDifficulty: value.suggestedCleanupDifficulty,
    suggestedAdultHelpRequired: value.suggestedAdultHelpRequired,
    confidence: value.confidence,
    warnings: dedupe(value.warnings),
  };
}

export const defaultToyAnalysisService = new ToyAnalysisService();
