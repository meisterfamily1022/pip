import { Platform } from 'react-native';
import { Directory, File, Paths } from 'expo-file-system';
import { compressForManagedStorage, expoCompressionApi } from './toy-image-compression';

export interface ToyImageStorage {
  copyIntoManagedStorage(sourceUri: string): Promise<string>;
  deleteManagedImage(uri: string | null): Promise<void>;
  fingerprintImage?(uri: string): Promise<string | null>;
}

export async function deleteUniqueManagedImages(storage: ToyImageStorage, uris: readonly (string | null)[]): Promise<number> {
  let failures = 0;
  for (const uri of [...new Set(uris.filter((candidate): candidate is string => Boolean(candidate)))]) {
    try { await storage.deleteManagedImage(uri); } catch { failures += 1; /* Attempt every distinct image; caller owns error reporting. */ }
  }
  return failures;
}

function uniqueImageName(extension: string): string {
  const random = Math.random().toString(36).slice(2);
  return `toy-${Date.now()}-${random}.${extension}`;
}

function ensureToyDirectory(): Directory {
  const directory = new Directory(Paths.document, 'toy-images');
  if (!directory.exists) directory.create({ intermediates: true, idempotent: true });
  return directory;
}

const managedToyImagePathMarker = '/Documents/toy-images/';

/**
 * iOS changes an app's data-container UUID when installing a new build. Files
 * in Documents move with the app data, but an absolute file URI stored in
 * SQLite still contains the previous UUID. Rebase only Pip-managed toy-image
 * URIs onto the current Documents directory; picker/cache/external URIs stay
 * untouched.
 */
export function resolveManagedToyImageUri(
  uri: string,
  managedDirectoryUri: string = new Directory(Paths.document, 'toy-images').uri,
): string {
  if (Platform.OS === 'web' || !uri.startsWith('file:')) return uri;
  const markerIndex = uri.lastIndexOf(managedToyImagePathMarker);
  if (markerIndex < 0) return uri;
  const relativePath = uri.slice(markerIndex + managedToyImagePathMarker.length);
  if (!relativePath || relativePath.includes('/')) return uri;
  return `${managedDirectoryUri.replace(/\/?$/, '/')}${relativePath}`;
}

async function durableWebImageUri(sourceUri: string): Promise<string> {
  if (sourceUri.startsWith('data:')) return sourceUri;
  const response = await fetch(sourceUri);
  if (!response.ok) throw new Error('The selected photo could not be read.');
  const blob = await response.blob();
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('The selected photo could not be saved.'));
    reader.onload = () => typeof reader.result === 'string' ? resolve(reader.result) : reject(new Error('The selected photo could not be saved.'));
    reader.readAsDataURL(blob);
  });
}

export const expoToyImageStorage: ToyImageStorage = {
  async copyIntoManagedStorage(sourceUri: string): Promise<string> {
    if (Platform.OS === 'web') return durableWebImageUri(sourceUri);
    // Compression re-encodes as JPEG unconditionally (see toy-image-compression.ts),
    // so the managed copy is always .jpg regardless of what the picker handed back.
    const compressedUri = await compressForManagedStorage(resolveManagedToyImageUri(sourceUri), expoCompressionApi);
    const source = new File(compressedUri);
    const destination = new File(ensureToyDirectory(), uniqueImageName('jpg'));
    try {
      await source.copy(destination);
    } finally {
      if (source.exists) source.delete();
    }
    return destination.uri;
  },

  async deleteManagedImage(uri: string | null): Promise<void> {
    if (!uri || Platform.OS === 'web') return;
    const managedPrefix = new Directory(Paths.document, 'toy-images').uri;
    const resolvedUri = resolveManagedToyImageUri(uri, managedPrefix);
    if (!resolvedUri.startsWith(managedPrefix)) return;
    const file = new File(resolvedUri);
    if (file.exists) file.delete();
  },

  async fingerprintImage(uri: string): Promise<string | null> {
    if (Platform.OS !== 'web') return new File(resolveManagedToyImageUri(uri)).md5;
    let hash = 2166136261;
    for (let index = 0; index < uri.length; index += 1) {
      hash ^= uri.charCodeAt(index);
      hash = Math.imul(hash, 16777619);
    }
    return `${uri.length}-${(hash >>> 0).toString(36)}`;
  },
};
