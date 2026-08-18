import { Platform } from 'react-native';
import { Directory, File, Paths } from 'expo-file-system';

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

function extensionFromUri(uri: string): string {
  const clean = uri.split('?')[0]?.split('#')[0] ?? uri;
  const match = clean.match(/\.([a-zA-Z0-9]{1,8})$/);
  return match?.[1]?.toLowerCase() ?? 'jpg';
}

function uniqueImageName(sourceUri: string): string {
  const random = Math.random().toString(36).slice(2);
  return `toy-${Date.now()}-${random}.${extensionFromUri(sourceUri)}`;
}

function ensureToyDirectory(): Directory {
  const directory = new Directory(Paths.document, 'toy-images');
  if (!directory.exists) directory.create({ intermediates: true, idempotent: true });
  return directory;
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
    const source = new File(sourceUri);
    const destination = new File(ensureToyDirectory(), uniqueImageName(sourceUri));
    await source.copy(destination);
    return destination.uri;
  },

  async deleteManagedImage(uri: string | null): Promise<void> {
    if (!uri || Platform.OS === 'web') return;
    const managedPrefix = new Directory(Paths.document, 'toy-images').uri;
    if (!uri.startsWith(managedPrefix)) return;
    const file = new File(uri);
    if (file.exists) file.delete();
  },

  async fingerprintImage(uri: string): Promise<string | null> {
    if (Platform.OS !== 'web') return new File(uri).md5;
    let hash = 2166136261;
    for (let index = 0; index < uri.length; index += 1) {
      hash ^= uri.charCodeAt(index);
      hash = Math.imul(hash, 16777619);
    }
    return `${uri.length}-${(hash >>> 0).toString(36)}`;
  },
};
