import { preferredImageVariantFor, selectToyImageUri } from './toy-image-selection';

describe('toy image selection', () => {
  it('uses enhanced only when it is preferred and available', () => {
    expect(selectToyImageUri({ originalImageUri: 'file:///original.jpg', enhancedImageUri: 'file:///enhanced.png', preferredImageVariant: 'enhanced' })).toBe('file:///enhanced.png');
    expect(selectToyImageUri({ originalImageUri: 'file:///original.jpg', enhancedImageUri: null, preferredImageVariant: 'enhanced' })).toBe('file:///original.jpg');
  });

  it('uses original by default and safely supports legacy imageUri', () => {
    expect(selectToyImageUri({ originalImageUri: 'file:///original.jpg', enhancedImageUri: 'file:///enhanced.png', preferredImageVariant: 'original' })).toBe('file:///original.jpg');
    expect(selectToyImageUri({ originalImageUri: null, enhancedImageUri: null, preferredImageVariant: 'original', imageUri: 'file:///legacy.jpg' })).toBe('file:///legacy.jpg');
  });

  it('normalizes a missing enhanced choice back to original', () => {
    expect(preferredImageVariantFor(false, 'enhanced')).toBe('original');
    expect(preferredImageVariantFor(true, 'enhanced')).toBe('enhanced');
  });
});
