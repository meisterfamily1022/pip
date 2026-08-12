import { getSessionSnapshot } from '@/features/auth/session-state';
import { supabase } from '@/lib/supabase';

export type EntitlementState = 'free' | 'plus' | 'admin_test';
export type Entitlement = { state: EntitlementState; plusEnabled: boolean; plusVisible: boolean };
export const FREE_LAUNCH: Entitlement = { state: 'free', plusEnabled: false, plusVisible: false };

export async function getEntitlement(): Promise<Entitlement> {
  if (getSessionSnapshot().status !== 'signedIn') return FREE_LAUNCH;
  try {
    const { data, error } = await supabase.rpc('get_my_entitlement');
    if (error || !data || data.plusEnabled !== true || data.plusVisible !== true) return { state: data?.state ?? 'free', plusEnabled: false, plusVisible: false };
    return data as Entitlement;
  } catch { return FREE_LAUNCH; }
}

export async function mayUse(_feature: string): Promise<boolean> {
  const entitlement = await getEntitlement();
  return !entitlement.plusEnabled || entitlement.state === 'plus' || entitlement.state === 'admin_test';
}

