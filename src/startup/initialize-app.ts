import { initializeDatabase } from '@/database/client';
import { getSettings } from '@/repositories/settings-repository';
import { getStartupDestination, type StartupDestination } from './startup-routing';

export async function initializeApp(): Promise<StartupDestination> {
  const database = await initializeDatabase();
  const settings = await getSettings(database);
  return getStartupDestination(settings);
}
