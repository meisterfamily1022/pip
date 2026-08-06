import { Platform } from 'react-native';

import { deleteToyPhoto, replaceToyPhoto, saveToyPhoto } from './toy-photos';

const mockDirectory = jest.fn(() => {
  throw new Error('native Directory should not be constructed on web');
});
const mockFile = jest.fn(() => {
  throw new Error('native File should not be constructed on web');
});

jest.mock('expo-file-system', () => ({
  Directory: mockDirectory,
  File: mockFile,
  Paths: { document: 'file:///documents' },
}));

describe('web toy photo storage', () => {
  const originalOS = Platform.OS;
  const originalFetch = globalThis.fetch;
  const originalFileReader = globalThis.FileReader;

  beforeAll(() => {
    Object.defineProperty(Platform, 'OS', { configurable: true, value: 'web' });
    globalThis.fetch = jest.fn(async () => ({
      blob: async () => ({ type: 'image/png' }),
      ok: true,
    })) as unknown as typeof fetch;
    globalThis.FileReader = class {
      error = null;
      onerror: (() => void) | null = null;
      onload: (() => void) | null = null;
      result: string | ArrayBuffer | null = null;

      readAsDataURL() {
        this.result = 'data:image/png;base64,dGVzdA==';
        this.onload?.();
      }
    } as unknown as typeof FileReader;
  });

  afterAll(() => {
    Object.defineProperty(Platform, 'OS', { configurable: true, value: originalOS });
    globalThis.fetch = originalFetch;
    globalThis.FileReader = originalFileReader;
  });

  it('keeps browser-readable image URIs out of the native filesystem shim', async () => {
    await expect(saveToyPhoto('blob:http://localhost/photo')).resolves.toBe('data:image/png;base64,dGVzdA==');
    await expect(replaceToyPhoto(null, 'blob:http://localhost/photo')).resolves.toBe('data:image/png;base64,dGVzdA==');
    await expect(saveToyPhoto('data:image/png;base64,ready')).resolves.toBe('data:image/png;base64,ready');
    await expect(deleteToyPhoto('blob:http://localhost/photo')).resolves.toBeUndefined();
    expect(mockDirectory).not.toHaveBeenCalled();
    expect(mockFile).not.toHaveBeenCalled();
  });
});
