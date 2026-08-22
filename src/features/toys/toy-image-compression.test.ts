import {
  MAX_MANAGED_TOY_IMAGE_BYTES,
  MAX_TOY_IMAGE_DIMENSION,
  TOY_IMAGE_RETRY_QUALITY,
  TOY_IMAGE_SAVE_QUALITY,
  UnusableImageError,
  chooseResizeTarget,
  compressForManagedStorage,
  type CompressionApi,
} from './toy-image-compression';

describe('chooseResizeTarget', () => {
  it('leaves an already-small photo alone', () => {
    expect(chooseResizeTarget({ width: 800, height: 600 })).toBeNull();
  });

  it('constrains the width when landscape exceeds the cap', () => {
    expect(chooseResizeTarget({ width: 4032, height: 3024 })).toEqual({ width: MAX_TOY_IMAGE_DIMENSION });
  });

  it('constrains the height when portrait exceeds the cap', () => {
    // The longer edge is height here — constraining width instead would leave
    // the actual long edge (height) still over the cap.
    expect(chooseResizeTarget({ width: 3024, height: 4032 })).toEqual({ height: MAX_TOY_IMAGE_DIMENSION });
  });

  it('never enlarges a small photo up to the cap', () => {
    expect(chooseResizeTarget({ width: 200, height: 4000 })).toEqual({ height: MAX_TOY_IMAGE_DIMENSION });
    // width (200) stays below the cap and is left to scale automatically,
    // not forced up to it.
  });

  it('treats a photo exactly at the cap as already small enough', () => {
    expect(chooseResizeTarget({ width: MAX_TOY_IMAGE_DIMENSION, height: MAX_TOY_IMAGE_DIMENSION })).toBeNull();
  });
});

function fakeApi(overrides: Partial<CompressionApi> = {}): CompressionApi & { rendered: { uri: string; quality: number }[]; deleted: string[] } {
  const rendered: { uri: string; quality: number }[] = [];
  const deleted: string[] = [];
  const sizes: Record<string, number | null> = { 'file:///rendered-1.jpg': 1000, 'file:///rendered-2.jpg': 500 };
  let renderCount = 0;
  const api: CompressionApi & { rendered: typeof rendered; deleted: typeof deleted } = {
    rendered,
    deleted,
    getSize: async () => ({ width: 3000, height: 2000 }),
    manipulate: (uri: string) => {
      const context = {
        resize: () => context,
        renderAsync: async () => ({
          saveAsync: async (options: { compress: number }) => {
            renderCount += 1;
            const outputUri = `file:///rendered-${renderCount}.jpg`;
            rendered.push({ uri: outputUri, quality: options.compress });
            return { uri: outputUri };
          },
        }),
      };
      void uri;
      return context;
    },
    fileSize: async (uri: string) => (uri in sizes ? sizes[uri] : 200),
    deleteFile: async (uri: string) => { deleted.push(uri); },
    ...overrides,
  };
  return api;
}

describe('compressForManagedStorage', () => {
  it('resizes and re-encodes at the standard quality when the result fits under the cap', async () => {
    const api = fakeApi({ fileSize: async () => 300 });
    const uri = await compressForManagedStorage('file:///source.heic', api);
    expect(uri).toBe('file:///rendered-1.jpg');
    expect(api.rendered).toEqual([{ uri: 'file:///rendered-1.jpg', quality: TOY_IMAGE_SAVE_QUALITY }]);
  });

  it('retries at a lower quality when the first render exceeds the byte cap', async () => {
    let call = 0;
    const api = fakeApi({
      fileSize: async () => { call += 1; return call === 1 ? MAX_MANAGED_TOY_IMAGE_BYTES + 1 : 300; },
    });
    const uri = await compressForManagedStorage('file:///source.jpg', api);
    expect(uri).toBe('file:///rendered-2.jpg');
    expect(api.rendered.map((r) => r.quality)).toEqual([TOY_IMAGE_SAVE_QUALITY, TOY_IMAGE_RETRY_QUALITY]);
    // The oversized first attempt is cleaned up, not left behind.
    expect(api.deleted).toContain('file:///rendered-1.jpg');
  });

  it('refuses a photo still too large after the retry, and cleans up', async () => {
    const api = fakeApi({ fileSize: async () => MAX_MANAGED_TOY_IMAGE_BYTES + 1 });
    await expect(compressForManagedStorage('file:///source.jpg', api)).rejects.toThrow(UnusableImageError);
    expect(api.deleted).toEqual(['file:///rendered-1.jpg', 'file:///rendered-2.jpg']);
  });

  it('treats an unreadable file size as trustworthy rather than blocking a save', async () => {
    const api = fakeApi({ fileSize: async () => null });
    await expect(compressForManagedStorage('file:///source.jpg', api)).resolves.toBe('file:///rendered-1.jpg');
  });

  it('reports a photo the manipulator cannot even read its size for', async () => {
    const api = fakeApi({ getSize: async () => { throw new Error('not an image'); } });
    await expect(compressForManagedStorage('file:///not-a-photo.txt', api)).rejects.toThrow(UnusableImageError);
  });

  it('reports a photo that fails to decode or re-encode', async () => {
    const api = fakeApi({
      manipulate: () => ({
        resize: function resize(this: unknown) { return this as never; },
        renderAsync: async () => { throw new Error('corrupt image data'); },
      }),
    });
    await expect(compressForManagedStorage('file:///corrupt.jpg', api)).rejects.toThrow(UnusableImageError);
  });
});
