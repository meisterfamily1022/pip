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
import { telemetry } from '@/features/analytics/telemetry-client';

export type CleanupState = {
  activeSession: ActivePlaySession | null;
  cleanupRequired: boolean;
};

export async function loadCleanupState(database: DatabaseConnection, childId: number): Promise<CleanupState> {
  const [activeSession, settings] = await Promise.all([getActivePlaySession(database, childId), getSettings(database)]);
  return { activeSession, cleanupRequired: settings.cleanupRequired };
}

export async function beginCleanup(database: DatabaseConnection, childId: number): Promise<ActivePlaySession> {
  const active = await getActivePlaySession(database, childId);
  if (!active) throw new Error('There is no active toy to clean up.');
  if (active.status === 'completed') throw new Error('This play session is already complete.');
  await markCleanupStarted(database, active.id, childId);
  const next = await getActivePlaySession(database, childId);
  if (!next) throw new Error('Cleanup session could not be recovered.');
  return next;
}

export async function requestCleanupHelp(database: DatabaseConnection, childId: number): Promise<ActivePlaySession> {
  const active = await getActivePlaySession(database, childId);
  if (!active) throw new Error('There is no active cleanup session.');
  await markCleanupHelpRequested(database, active.id, childId);
  const next = await getActivePlaySession(database, childId);
  if (!next) throw new Error('Cleanup session could not be recovered.');
  return next;
}

export async function completeCleanup(database: DatabaseConnection, childId: number): Promise<void> {
  const active = await getActivePlaySession(database, childId);
  if (!active) throw new Error('There is no active cleanup session.');
  await completePlaySession(database, active.id, childId);
  void telemetry.track('cleanup_completed');
}

export async function completeCleanupWithParentOverride(database: DatabaseConnection, childId: number): Promise<void> {
  const active = await getActivePlaySession(database, childId);
  if (!active) throw new Error('There is no active cleanup session.');
  await completePlaySessionWithParentOverride(database, active.id, childId);
}
