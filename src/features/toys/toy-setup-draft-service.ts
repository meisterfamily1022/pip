import type { DatabaseConnection } from '@/database/types';
import { deleteToySetupDraft, getToySetupDraft } from './toy-setup-draft-repository';
import type { ToySetupDraft } from '@/domain/models';
import { expoToyImageStorage, type ToyImageStorage } from './toy-image-storage';

async function adoptedImageUris(database: DatabaseConnection): Promise<Set<string>> {
  const rows = await database.getAllAsync<{ image_uri: string | null; original_image_uri: string | null; enhanced_image_uri: string | null }>('SELECT image_uri, original_image_uri, enhanced_image_uri FROM toys;');
  return new Set(rows.flatMap((row) => [row.image_uri, row.original_image_uri, row.enhanced_image_uri].filter((uri): uri is string => Boolean(uri))));
}

export async function discardToySetupDraft(database: DatabaseConnection, id: string, storage: ToyImageStorage = expoToyImageStorage): Promise<void> {
  const draft = await getToySetupDraft(database, id);
  if (!draft) throw new Error('Toy setup draft not found.');
  const adopted = await adoptedImageUris(database);
  await deleteToySetupDraft(database, id);
  const imageUris = [...new Set([draft.originalImageUri, draft.enhancedImageUri].filter((uri): uri is string => Boolean(uri)).filter((uri) => !adopted.has(uri)))];
  let cleanupFailures = 0;
  for (const uri of imageUris) {
    try { await storage.deleteManagedImage(uri); } catch { cleanupFailures += 1; /* Database deletion is authoritative; cleanup may be retried. */ }
  }
  if (cleanupFailures > 0) console.warn('Toy setup draft image cleanup incomplete.');
}

export type { ToySetupDraft };
