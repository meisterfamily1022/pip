import * as ImagePicker from 'expo-image-picker';
import { Platform } from 'react-native';
import { validateIntakeAsset } from './toy-batch-drafts';

export type ImageIntakeAsset = { uri: string; mimeType?: string | null; fileSize?: number | null };
export type ImageIntakeResult = { uris: string[]; assets: ImageIntakeAsset[]; cancelled: boolean; error: string | null };
export const TOY_IMAGE_COMPRESSION_QUALITY = 0.82;

export function normalizeImagePickerResult(result: ImagePicker.ImagePickerResult): ImageIntakeResult {
  if (result.canceled || !result.assets?.length) return { uris: [], assets: [], cancelled: true, error: null };
  const acceptedCandidates = result.assets.filter((asset) => !validateIntakeAsset(asset));
  const rejected = result.assets.map((asset) => validateIntakeAsset(asset)).filter((error): error is string => Boolean(error));
  const seen = new Set<string>();
  const accepted = acceptedCandidates.filter((asset) => {
    if (seen.has(asset.uri)) return false;
    seen.add(asset.uri);
    return true;
  });
  const duplicateCount = acceptedCandidates.length - accepted.length;
  const uris = accepted.map((asset) => asset.uri).filter(Boolean);
  const skippedCount = rejected.length + duplicateCount;
  const skippedReason = rejected[0] ?? (duplicateCount ? 'Duplicate photos were ignored.' : null);
  return uris.length
    ? { uris, assets: accepted.map(({ uri, mimeType, fileSize }) => ({ uri, mimeType, fileSize })), cancelled: false, error: skippedCount ? `${skippedCount} photo${skippedCount === 1 ? '' : 's'} skipped: ${skippedReason}` : null }
    : { uris: [], assets: [], cancelled: false, error: rejected[0] ?? 'No usable image was selected.' };
}

type LibraryPickerApi = Pick<typeof ImagePicker, 'launchImageLibraryAsync'>;

export async function selectToyImages(multiple = false, api: LibraryPickerApi = ImagePicker): Promise<ImageIntakeResult> {
  try {
    return normalizeImagePickerResult(await api.launchImageLibraryAsync({ mediaTypes: ['images'], allowsMultipleSelection: multiple, orderedSelection: multiple, quality: TOY_IMAGE_COMPRESSION_QUALITY }));
  } catch { return { uris: [], assets: [], cancelled: false, error: 'Could not open your photos. Please try again.' }; }
}

export async function recoverPendingToyImages(): Promise<ImageIntakeResult | null> {
  if (Platform.OS !== 'android') return null;
  try {
    const result = await ImagePicker.getPendingResultAsync();
    if (!result) return null;
    if ('code' in result) return { uris: [], assets: [], cancelled: false, error: result.message || 'Could not recover the selected photo.' };
    return normalizeImagePickerResult(result);
  } catch {
    return { uris: [], assets: [], cancelled: false, error: 'Could not recover the selected photo.' };
  }
}

type CameraPickerApi = Pick<typeof ImagePicker, 'requestCameraPermissionsAsync' | 'launchCameraAsync'>;

export async function captureWithSystemCamera(api: CameraPickerApi = ImagePicker, platform: typeof Platform.OS = Platform.OS): Promise<ImageIntakeResult> {
  if (platform === 'web') return { uris: [], assets: [], cancelled: false, error: 'Camera capture requires the Pip iOS or Android app. You can choose a photo in this browser.' };
  try {
    const permission = await api.requestCameraPermissionsAsync();
    if (!permission.granted) return {
      uris: [],
      assets: [],
      cancelled: false,
      error: permission.canAskAgain
        ? 'Camera access was not allowed. You can choose a photo instead.'
        : 'Camera access is blocked in device settings. You can enable it there or choose a photo instead.',
    };
    return normalizeImagePickerResult(await api.launchCameraAsync({ mediaTypes: ['images'], quality: TOY_IMAGE_COMPRESSION_QUALITY }));
  } catch { return { uris: [], assets: [], cancelled: false, error: 'Could not open the camera. Please try again or choose a photo.' }; }
}
