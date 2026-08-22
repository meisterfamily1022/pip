import { Image as RNImage } from 'react-native';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';

/**
 * A toy photo never needs to be larger than this on its longer edge — every
 * place Pip shows one is a card or a hero crop, never a zoomed original. A
 * phone camera routinely hands back 3000-4000px images; storing those
 * verbatim is pure waste of device storage and upload bandwidth for no
 * visible gain.
 */
export const MAX_TOY_IMAGE_DIMENSION = 1600;
export const TOY_IMAGE_SAVE_QUALITY = 0.72;
export const TOY_IMAGE_RETRY_QUALITY = 0.5;

/**
 * The hard cap enforced against the actual re-encoded bytes, not the
 * picker's self-reported (and sometimes absent) `fileSize`. A resize to
 * MAX_TOY_IMAGE_DIMENSION at TOY_IMAGE_SAVE_QUALITY should never come close
 * to this for an ordinary photo; it exists for the unusual input — a huge
 * flat-color PNG, an adversarial file — that compresses poorly.
 */
export const MAX_MANAGED_TOY_IMAGE_BYTES = 5 * 1024 * 1024;

export type ImageDimensions = { width: number; height: number };

/**
 * Which single dimension to constrain, so the longer edge — whichever one it
 * is — never exceeds the cap while the other scales to preserve the photo's
 * aspect ratio. `null` means the photo is already small enough to leave
 * alone; this only ever downscales, never enlarges a small photo up to the
 * cap.
 */
export function chooseResizeTarget(
  size: ImageDimensions,
  maxDimension: number = MAX_TOY_IMAGE_DIMENSION,
): { width: number } | { height: number } | null {
  if (size.width <= maxDimension && size.height <= maxDimension) return null;
  return size.width >= size.height ? { width: maxDimension } : { height: maxDimension };
}

/** A photo that could not be decoded, resized, or re-encoded — not a real image, or too damaged to use. */
export class UnusableImageError extends Error {}

type RenderedImage = { uri: string };
type ManipulationContext = {
  resize(size: { width?: number; height?: number }): ManipulationContext;
  renderAsync(): Promise<{ saveAsync(options: { compress: number; format: unknown }): Promise<RenderedImage> }>;
};

export type CompressionApi = {
  getSize(uri: string): Promise<ImageDimensions>;
  manipulate(uri: string): ManipulationContext;
  fileSize(uri: string): Promise<number | null>;
  deleteFile(uri: string): Promise<void>;
};

async function render(api: CompressionApi, uri: string, target: { width?: number; height?: number } | null, quality: number): Promise<string> {
  const context = api.manipulate(uri);
  if (target) context.resize(target);
  const image = await context.renderAsync();
  const saved = await image.saveAsync({ compress: quality, format: SaveFormat.JPEG });
  return saved.uri;
}

/**
 * Downscales a captured or picked photo to at most {@link MAX_TOY_IMAGE_DIMENSION}
 * on its longer edge and re-encodes it as JPEG — unconditionally, which is
 * also what normalises HEIC (and anything else a device hands back) into a
 * format every platform can display and upload without special-casing.
 *
 * A result that still exceeds {@link MAX_MANAGED_TOY_IMAGE_BYTES} gets one
 * retry at a lower quality; still too large after that is refused outright
 * rather than stored, because an unbounded photo defeats the point of a
 * limit. The caller owns the returned URI (a fresh file this function
 * created) and is responsible for moving or deleting it.
 */
export async function compressForManagedStorage(sourceUri: string, api: CompressionApi): Promise<string> {
  let size: ImageDimensions;
  try {
    size = await api.getSize(sourceUri);
  } catch {
    throw new UnusableImageError('This photo could not be read. Try a different one.');
  }
  const target = chooseResizeTarget(size);

  let renderedUri: string;
  try {
    renderedUri = await render(api, sourceUri, target, TOY_IMAGE_SAVE_QUALITY);
  } catch {
    throw new UnusableImageError('This photo could not be processed. Try a different one.');
  }

  const bytes = await api.fileSize(renderedUri);
  if (bytes === null || bytes <= MAX_MANAGED_TOY_IMAGE_BYTES) return renderedUri;

  await api.deleteFile(renderedUri);
  const retryUri = await render(api, sourceUri, target, TOY_IMAGE_RETRY_QUALITY);
  const retryBytes = await api.fileSize(retryUri);
  if (retryBytes !== null && retryBytes > MAX_MANAGED_TOY_IMAGE_BYTES) {
    await api.deleteFile(retryUri);
    throw new UnusableImageError('This photo is too large to save, even after compression. Try a different one.');
  }
  return retryUri;
}

export const expoCompressionApi: CompressionApi = {
  getSize: (uri) => new Promise<ImageDimensions>((resolve, reject) => {
    RNImage.getSize(uri, (width, height) => resolve({ width, height }), reject);
  }),
  manipulate: (uri) => ImageManipulator.manipulate(uri) as unknown as ManipulationContext,
  fileSize: async (uri) => {
    const { File } = await import('expo-file-system');
    const file = new File(uri);
    return file.exists ? file.size : null;
  },
  deleteFile: async (uri) => {
    const { File } = await import('expo-file-system');
    const file = new File(uri);
    if (file.exists) file.delete();
  },
};
