import { Platform } from 'react-native';
import { Directory, File, Paths } from 'expo-file-system';

export interface ToyImageStorage {
  copyIntoManagedStorage(sourceUri: string): Promise<string>;
  deleteManagedImage(uri: string | null): Promise<void>;
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

export const expoToyImageStorage: ToyImageStorage = {
  async copyIntoManagedStorage(sourceUri: string): Promise<string> {
    if (Platform.OS === 'web') return sourceUri;
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
};
