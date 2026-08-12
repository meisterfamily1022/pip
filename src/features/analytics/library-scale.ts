import type { DatabaseConnection } from '@/database/types';
import { telemetry } from './telemetry-client';

const band = (count: number): '0'|'1'|'2'|'3'|'4-9'|'10-24'|'25-49'|'50+' => count < 4 ? String(count) as '0'|'1'|'2'|'3' : count < 10 ? '4-9' : count < 25 ? '10-24' : count < 50 ? '25-49' : '50+';
export async function trackLibraryScale(database: DatabaseConnection): Promise<void> {
  try {
    const [toys,rooms,spots,categories] = await Promise.all([
      database.getFirstAsync<{total:number}>('SELECT COUNT(*) total FROM toys WHERE is_archived=0;'),
      database.getFirstAsync<{total:number}>('SELECT COUNT(*) total FROM rooms;'),
      database.getFirstAsync<{total:number}>('SELECT COUNT(*) total FROM storage_spots;'),
      database.getFirstAsync<{total:number}>('SELECT COUNT(DISTINCT category) total FROM toy_categories;'),
    ]);
    await telemetry.track('library_scale',{toys:band(toys?.total??0),rooms:band(rooms?.total??0),storageSpots:band(spots?.total??0),categories:band(categories?.total??0)});
  } catch { /* Derived analytics never affects local persistence. */ }
}
