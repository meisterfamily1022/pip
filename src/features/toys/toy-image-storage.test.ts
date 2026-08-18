import { resolveManagedToyImageUri } from './toy-image-storage';

describe('resolveManagedToyImageUri', () => {
  const currentDirectory = 'file:///new-container/Documents/toy-images/';

  it('rebases a managed image after the iOS data-container UUID changes', () => {
    expect(resolveManagedToyImageUri(
      'file:///old-container/Documents/toy-images/toy-123.jpg',
      currentDirectory,
    )).toBe('file:///new-container/Documents/toy-images/toy-123.jpg');
  });

  it('leaves external and non-file image URIs untouched', () => {
    expect(resolveManagedToyImageUri('file:///tmp/picker/photo.jpg', currentDirectory))
      .toBe('file:///tmp/picker/photo.jpg');
    expect(resolveManagedToyImageUri('https://example.com/photo.jpg', currentDirectory))
      .toBe('https://example.com/photo.jpg');
    expect(resolveManagedToyImageUri('data:image/png;base64,abc', currentDirectory))
      .toBe('data:image/png;base64,abc');
  });

  it('does not rebase unexpected nested paths inside managed storage', () => {
    const uri = 'file:///old-container/Documents/toy-images/nested/toy.jpg';
    expect(resolveManagedToyImageUri(uri, currentDirectory)).toBe(uri);
  });
});
