import type { ToyImageStorage } from '@/features/toys/toy-image-storage';

import type { RemoteHouseholdGateway } from './remote-gateway';

/**
 * Toy photographs, uploaded and restored — not left as a remote URL.
 *
 * "Backed up" has to mean the photograph is actually recoverable, not that a
 * link to it exists somewhere the app depends on staying reachable. So a
 * download always runs through the same canonical local-storage pipeline a
 * camera capture does (`ToyImageStorage.copyIntoManagedStorage`), and an
 * upload is skipped once the local fingerprint matches what was last
 * successfully sent — a photo that has not changed does not need resending.
 */

export type UploadOutcome =
  | { uploaded: false; reason: 'unchanged' }
  | { uploaded: true; path: string; fingerprint: string | null };

export async function uploadToyImageIfChanged(
  gateway: RemoteHouseholdGateway,
  storage: ToyImageStorage,
  remoteHouseholdId: string,
  toyLocalId: number,
  localImageUri: string,
  previouslySyncedFingerprint: string | null,
): Promise<UploadOutcome> {
  const fingerprint = (await storage.fingerprintImage?.(localImageUri)) ?? null;
  // No fingerprinting available (a storage backend that does not support it):
  // upload every time rather than risk skipping a real change.
  if (fingerprint !== null && fingerprint === previouslySyncedFingerprint) {
    return { uploaded: false, reason: 'unchanged' };
  }
  const { path } = await gateway.uploadImage(remoteHouseholdId, toyLocalId, localImageUri);
  return { uploaded: true, path, fingerprint };
}

/**
 * Downloads a toy's photo and imports it into local managed storage.
 *
 * Returns the local URI the rest of the app already knows how to draw — the
 * same shape `copyIntoManagedStorage` returns for a camera capture, so
 * nothing downstream needs to know a photo arrived over the network rather
 * than through the camera.
 */
export async function downloadAndImportToyImage(
  gateway: RemoteHouseholdGateway,
  storage: ToyImageStorage,
  remoteHouseholdId: string,
  imagePath: string,
): Promise<{ localUri: string; fingerprint: string | null }> {
  const { tempUri } = await gateway.downloadImage(remoteHouseholdId, imagePath);
  const localUri = await storage.copyIntoManagedStorage(tempUri);
  const fingerprint = (await storage.fingerprintImage?.(localUri)) ?? null;
  return { localUri, fingerprint };
}
