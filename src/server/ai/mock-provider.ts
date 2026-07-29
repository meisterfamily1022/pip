import type { ProviderResponse } from './contracts';
import { ProviderTimeoutError, ProviderUnavailableError, type SanitizedAnalysisInput, type ToyAnalysisProvider } from './provider';

/** Deterministic Stage 1 fixture. It does not inspect or analyze an image. */
export class MockToyAnalysisProvider implements ToyAnalysisProvider {
  async analyze(input: SanitizedAnalysisInput): Promise<unknown> {
    switch (input.mockReference) {
      case 'unclear_image':
        return {
          suggestedName: null,
          suggestedCategories: [],
          suggestedCleanupDifficulty: null,
          suggestedAdultHelpRequired: null,
          confidence: 'low',
          warnings: ['image_unclear'],
        } satisfies ProviderResponse;
      case 'multiple_toys':
        return {
          suggestedName: 'Toy Set',
          suggestedCategories: ['active', 'together', 'indoor'],
          suggestedCleanupDifficulty: 'medium',
          suggestedAdultHelpRequired: null,
          confidence: 'medium',
          warnings: ['multiple_toys_detected', 'adult_review_recommended'],
        } satisfies ProviderResponse;
      case 'unidentified_toy':
        return {
          suggestedName: null,
          suggestedCategories: [],
          suggestedCleanupDifficulty: null,
          suggestedAdultHelpRequired: null,
          confidence: 'low',
          warnings: ['toy_not_identified'],
        } satisfies ProviderResponse;
      case 'malformed_response':
        return { suggestedName: 'not allowed', unexpected: true };
      case 'provider_timeout':
        throw new ProviderTimeoutError('mock timeout');
      case 'provider_unavailable':
        throw new ProviderUnavailableError('mock unavailable');
      case 'clear_toy':
      default:
        return {
          suggestedName: 'Building Blocks',
          suggestedCategories: ['building', 'creative', 'independent', 'indoor'],
          suggestedCleanupDifficulty: 'easy',
          suggestedAdultHelpRequired: false,
          confidence: 'high',
          warnings: [],
        } satisfies ProviderResponse;
    }
  }
}
