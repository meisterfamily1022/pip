import type { DatabaseConnection } from '@/database/types';
import type { ActivePlaySession } from '@/repositories/play-sessions-repository';
import {
  completePlaySession,
  completePlaySessionWithParentOverride,
  getActivePlaySession,
  markCleanupHelpRequested,
  markCleanupStarted,
} from '@/repositories/play-sessions-repository';
import { getSettings } from '@/repositories/settings-repository';

export type CleanupState = {
  activeSession: ActivePlaySession | null;
  cleanupRequired: boolean;
};

export async function loadCleanupState(database: DatabaseConnection): Promise<CleanupState> {
  const [activeSession, settings] = await Promise.all([getActivePlaySession(database), getSettings(database)]);
  return { activeSession, cleanupRequired: settings.cleanupRequired };
}

export async function beginCleanup(database: DatabaseConnection): Promise<ActivePlaySession> {
  const active = await getActivePlaySession(database);
  if (!active) throw new Error('There is no active toy to clean up.');
  if (active.status === 'completed') throw new Error('This play session is already complete.');
  await markCleanupStarted(database, active.id);
  const next = await getActivePlaySession(database);
  if (!next) throw new Error('Cleanup session could not be recovered.');
  return next;
}

export async function requestCleanupHelp(database: DatabaseConnection): Promise<ActivePlaySession> {
  const active = await getActivePlaySession(database);
  if (!active) throw new Error('There is no active cleanup session.');
  await markCleanupHelpRequested(database, active.id);
  const next = await getActivePlaySession(database);
  if (!next) throw new Error('Cleanup session could not be recovered.');
  return next;
}

export async function completeCleanup(database: DatabaseConnection): Promise<void> {
  const active = await getActivePlaySession(database);
  if (!active) throw new Error('There is no active cleanup session.');
  await completePlaySession(database, active.id);
}

export async function completeCleanupWithParentOverride(database: DatabaseConnection): Promise<void> {
  const active = await getActivePlaySession(database);
  if (!active) throw new Error('There is no active cleanup session.');
  await completePlaySessionWithParentOverride(database, active.id);
}
