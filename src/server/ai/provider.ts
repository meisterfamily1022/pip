import type { ProviderResponse } from './contracts';

export type SanitizedAnalysisInput = {
  mediaType: 'image/jpeg' | 'image/png';
  byteLength: number;
  mockReference?: string;
};

export interface ToyAnalysisProvider {
  analyze(input: SanitizedAnalysisInput): Promise<unknown>;
}

export class ProviderTimeoutError extends Error {}
export class ProviderUnavailableError extends Error {}

export type MockProviderResponse = ProviderResponse;
