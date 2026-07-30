import type { DatabaseConnection } from '@/database/types';
import type { PlaySession } from '@/domain/models';
import type { PlayCategory } from '@/domain/play-category';
import {
  completePlaySession,
  createPlaySession,
  getActivePlaySession,
} from '@/repositories/play-sessions-repository';
import { getToyWithLocation, listSuggestibleToys, type ToyWithLocation } from '@/repositories/toys-repository';
import { getSettings } from '@/repositories/settings-repository';

/**
 * Child Mode play flow.
 *
 * V1 allows exactly one active toy at a time; it is stored as the single
 * 'active' row in `play_sessions` so it survives closing the app.
 */

export type CurrentToy = { session: PlaySession; toy: ToyWithLocation };

/**
 * Suggests toys for a play choice, capped at the parent's configured choice
 * limit. A null category means "Show me anything".
 */
export async function loadSuggestions(
  database: DatabaseConnection,
  category: PlayCategory | null,
): Promise<ToyWithLocation[]> {
  const settings = await getSettings(database);
  return listSuggestibleToys(database, category, settings.choiceLimit);
}

/**
 * Makes `toyId` the current toy. Any session still open is completed first so
 * the one-active-session rule holds even if cleanup was skipped.
 */
export async function startPlayingWith(database: DatabaseConnection, toyId: number): Promise<PlaySession> {
  const active = await getActivePlaySession(database);
  if (active) await completePlaySession(database, active.id);
  return createPlaySession(database, toyId);
}

/** The current toy with its location, or null when nothing is playing. */
export async function loadCurrentToy(database: DatabaseConnection): Promise<CurrentToy | null> {
  const session = await getActivePlaySession(database);
  if (!session) return null;
  const toy = await getToyWithLocation(database, session.toyId);
  if (!toy) return null;
  return { session, toy };
}

/** Ends the current play session once the child confirms everything is away. */
export async function finishPlaying(database: DatabaseConnection): Promise<void> {
  const active = await getActivePlaySession(database);
  if (!active) return;
  await completePlaySession(database, active.id);
}

/** Whether the child must complete cleanup before choosing another toy. */
export async function isCleanupRequired(database: DatabaseConnection): Promise<boolean> {
  const settings = await getSettings(database);
  return settings.cleanupRequired;
}
