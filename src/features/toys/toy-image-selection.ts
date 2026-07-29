import type { PreferredImageVariant, Toy } from '@/domain/models';

export function selectToyImageUri(input: Pick<Toy, 'originalImageUri' | 'enhancedImageUri' | 'preferredImageVariant'> & { imageUri?: string | null }): string | null {
  if (input.preferredImageVariant === 'enhanced' && input.enhancedImageUri) return input.enhancedImageUri;
  return input.originalImageUri ?? input.imageUri ?? null;
}

export function preferredImageVariantFor(hasEnhancedImage: boolean, preferred: PreferredImageVariant): PreferredImageVariant {
  return preferred === 'enhanced' && hasEnhancedImage ? 'enhanced' : 'original';
}
