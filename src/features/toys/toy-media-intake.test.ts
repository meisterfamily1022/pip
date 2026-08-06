import type * as ImagePicker from 'expo-image-picker';

import { captureWithSystemCamera, normalizeImagePickerResult, selectToyImages, TOY_IMAGE_COMPRESSION_QUALITY } from './toy-media-intake';
import { MAX_TOY_IMAGE_BYTES } from './toy-batch-drafts';

const permission = (granted: boolean): ImagePicker.PermissionResponse => ({
  granted,
  canAskAgain: true,
  expires: 'never',
  status: granted ? 'granted' : 'denied',
} as ImagePicker.PermissionResponse);

describe('toy media intake', () => {
  it('reports picker and camera cancellation', async () => {
    expect(normalizeImagePickerResult({ canceled: true, assets: null })).toMatchObject({ cancelled: true, uris: [] });
    const result = await captureWithSystemCamera({
      requestCameraPermissionsAsync: jest.fn().mockResolvedValue(permission(true)),
      launchCameraAsync: jest.fn().mockResolvedValue({ canceled: true, assets: null }),
    }, 'ios');
    expect(result).toMatchObject({ cancelled: true, uris: [] });
  });

  it('reports denied camera permission without opening the camera', async () => {
    const launch = jest.fn();
    const result = await captureWithSystemCamera({
      requestCameraPermissionsAsync: jest.fn().mockResolvedValue(permission(false)),
      launchCameraAsync: launch,
    }, 'android');
    expect(result.error).toMatch(/not allowed/i);
    expect(launch).not.toHaveBeenCalled();
  });

  it('directs permanently denied camera access to device settings or the library', async () => {
    const denied = { ...permission(false), canAskAgain: false };
    const result = await captureWithSystemCamera({
      requestCameraPermissionsAsync: jest.fn().mockResolvedValue(denied),
      launchCameraAsync: jest.fn(),
    }, 'ios');
    expect(result.error).toMatch(/device settings/i);
    expect(result.error).toMatch(/choose a photo/i);
  });

  it('reports camera launch failures', async () => {
    const result = await captureWithSystemCamera({
      requestCameraPermissionsAsync: jest.fn().mockResolvedValue(permission(true)),
      launchCameraAsync: jest.fn().mockRejectedValue(new Error('camera unavailable')),
    }, 'ios');
    expect(result.error).toMatch(/could not open the camera/i);
  });

  it('accepts one or multiple images and rejects invalid or oversized assets', () => {
    expect(normalizeImagePickerResult({ canceled: false, assets: [{ uri: 'one.jpg', width: 1, height: 1, type: 'image', mimeType: 'image/jpeg' }] }).uris).toEqual(['one.jpg']);
    const result = normalizeImagePickerResult({ canceled: false, assets: [
      { uri: 'one.jpg', width: 1, height: 1, type: 'image', mimeType: 'image/jpeg' },
      { uri: 'bad.pdf', width: 1, height: 1, type: 'image', mimeType: 'application/pdf' },
      { uri: 'huge.jpg', width: 1, height: 1, type: 'image', mimeType: 'image/jpeg', fileSize: MAX_TOY_IMAGE_BYTES + 1 },
      { uri: 'two.png', width: 1, height: 1, type: 'image', mimeType: 'image/png' },
    ] });
    expect(result.uris).toEqual(['one.jpg', 'two.png']);
    expect(result.error).toMatch(/2 photos skipped/i);
  });

  it('ignores duplicate selected assets and requests explicit compression', async () => {
    const duplicate = { uri: 'same.jpg', width: 1, height: 1, type: 'image' as const, mimeType: 'image/jpeg' };
    const result = normalizeImagePickerResult({ canceled: false, assets: [duplicate, duplicate] });
    expect(result.uris).toEqual(['same.jpg']);
    expect(result.error).toMatch(/duplicate/i);

    const launchImageLibraryAsync = jest.fn().mockResolvedValue({ canceled: true, assets: null });
    await selectToyImages(true, { launchImageLibraryAsync });
    expect(launchImageLibraryAsync).toHaveBeenCalledWith(expect.objectContaining({
      allowsMultipleSelection: true,
      quality: TOY_IMAGE_COMPRESSION_QUALITY,
    }));
  });

  it('explains the web camera limitation', async () => {
    const result = await captureWithSystemCamera(undefined, 'web');
    expect(result.error).toMatch(/iOS or Android/i);
  });
});
