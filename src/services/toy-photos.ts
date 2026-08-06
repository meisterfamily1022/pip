import { Directory, File, Paths } from 'expo-file-system';
import { Platform } from 'react-native';

/**
 * Toy photo storage.
 *
 * V1 keeps every photo on the device. Images chosen from the camera or library
 * land in a cache the OS may clear, so they are copied into the app's document
 * directory and the library stores that stable path.
 */

const PHOTO_DIRECTORY = 'toy-photos';

function photoDirectory(): Directory {
  const directory = new Directory(Paths.document, PHOTO_DIRECTORY);
  if (!directory.exists) directory.create({ intermediates: true });
  return directory;
}

function extensionFor(uri: string): string {
  const match = /\.([a-zA-Z0-9]+)(?:\?.*)?$/.exec(uri);
  return match ? match[1].toLowerCase() : 'jpg';
}

async function persistWebPhoto(sourceUri: string): Promise<string> {
  if (sourceUri.startsWith('data:')) return sourceUri;
  const response = await fetch(sourceUri);
  if (!response.ok) throw new Error('Could not read the selected photo.');
  const blob = await response.blob();
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error ?? new Error('Could not read the selected photo.'));
    reader.onload = () => {
      if (typeof reader.result === 'string') resolve(reader.result);
      else reject(new Error('Could not read the selected photo.'));
    };
    reader.readAsDataURL(blob);
  });
}

/**
 * Copies a picked image into permanent storage and returns the stored URI.
 * The caller keeps that URI on the toy record.
 */
export async function saveToyPhoto(sourceUri: string): Promise<string> {
  // SDK 57's File/Directory API is native-only. On web, image-picker URIs are
  // converted to persistent data URLs instead of reaching the native shim.
  if (Platform.OS === 'web') return persistWebPhoto(sourceUri);
  const directory = photoDirectory();
  const name = `toy-${Date.now()}-${Math.floor(Math.random() * 1_000_000)}.${extensionFor(sourceUri)}`;
  const destination = new File(directory, name);
  await new File(sourceUri).copy(destination);
  return destination.uri;
}

/** Removes a stored photo. Missing files are ignored so deletes stay idempotent. */
export async function deleteToyPhoto(storedUri: string | null): Promise<void> {
  if (!storedUri) return;
  if (Platform.OS === 'web') return;
  if (!storedUri.includes(PHOTO_DIRECTORY)) return;
  try {
    const file = new File(storedUri);
    if (file.exists) file.delete();
  } catch {
    // A photo that cannot be removed should never block the parent's edit.
  }
}

/**
 * Replaces a toy's photo, storing the new one and discarding the old.
 * Passing the already-stored URI is a no-op.
 */
export async function replaceToyPhoto(previousUri: string | null, nextSourceUri: string | null): Promise<string | null> {
  if (nextSourceUri === previousUri) return previousUri;
  const stored = nextSourceUri ? await saveToyPhoto(nextSourceUri) : null;
  await deleteToyPhoto(previousUri);
  return stored;
}
