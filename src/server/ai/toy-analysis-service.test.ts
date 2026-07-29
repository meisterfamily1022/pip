import { MockToyAnalysisProvider } from './mock-provider';
import { InMemoryUsageQuota } from './quota';
import { ToyAnalysisService } from './toy-analysis-service';
import type { ToyAnalysisRequest } from './contracts';

const token = 'inst_1234567890abcdef';
const image = { mediaType: 'image/jpeg' as const, byteLength: 1024, mockReference: 'clear_toy' as const };
const request = (requestId: string, imageOverride: ToyAnalysisRequest['image'] = image): ToyAnalysisRequest => ({ installationToken: token, image: imageOverride, requestId });

describe('ToyAnalysisService', () => {
  it('returns a strict normalized mock result', async () => {
    const result = await new ToyAnalysisService().analyze(request('11111111-1111-4111-8111-111111111111'));
    expect(result).toEqual({
      suggestedName: 'Building Blocks',
      suggestedCategories: ['building', 'creative', 'independent', 'indoor'],
      suggestedCleanupDifficulty: 'easy',
      suggestedAdultHelpRequired: false,
      confidence: 'high',
      warnings: [],
      requestId: '11111111-1111-4111-8111-111111111111',
    });
  });

  it('does not consume allowance twice for an idempotent request', async () => {
    const quota = new InMemoryUsageQuota();
    const service = new ToyAnalysisService(new MockToyAnalysisProvider(), quota);
    const first = await service.analyze(request('22222222-2222-4222-8222-222222222222'));
    const second = await service.analyze(request('22222222-2222-4222-8222-222222222222', { ...image, mockReference: 'provider_unavailable' }));
    expect(second).toEqual(first);
    expect(quota.getUsed(token)).toBe(1);
  });

  it('charges a provider failure once and keeps the error safe', async () => {
    const quota = new InMemoryUsageQuota();
    const service = new ToyAnalysisService(new MockToyAnalysisProvider(), quota);
    await expect(service.analyze(request('33333333-3333-4333-8333-333333333333', { ...image, mockReference: 'provider_timeout' })))
      .rejects.toMatchObject({ code: 'PROVIDER_TIMEOUT', retryable: true });
    expect(quota.getUsed(token)).toBe(1);
  });

  it('rejects unknown request fields before provider invocation', async () => {
    const provider = { analyze: jest.fn() };
    const service = new ToyAnalysisService(provider);
    await expect(service.analyze({ ...request('44444444-4444-4444-8444-444444444444'), childNickname: 'private' }))
      .rejects.toMatchObject({ code: 'INVALID_REQUEST' });
    expect(provider.analyze).not.toHaveBeenCalled();
  });

  it('rejects malformed provider output', async () => {
    const quota = new InMemoryUsageQuota();
    const service = new ToyAnalysisService(new MockToyAnalysisProvider(), quota);
    await expect(service.analyze(request('55555555-5555-4555-8555-555555555555', { ...image, mockReference: 'malformed_response' })))
      .rejects.toMatchObject({ code: 'INVALID_PROVIDER_RESPONSE' });
    expect(quota.getUsed(token)).toBe(1);
  });

  it('enforces the ten-scan mock allowance', async () => {
    const quota = new InMemoryUsageQuota();
    const service = new ToyAnalysisService(new MockToyAnalysisProvider(), quota);
    for (let index = 0; index < 10; index += 1) {
      await service.analyze(request(`66666666-6666-4666-8666-${String(index).padStart(12, '0')}`));
    }
    await expect(service.analyze(request('77777777-7777-4777-8777-777777777777')))
      .rejects.toMatchObject({ code: 'ALLOWANCE_EXHAUSTED' });
  });
});
