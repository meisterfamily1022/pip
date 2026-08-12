import { getSessionSnapshot } from '@/features/auth/session-state';
import { supabase } from '@/lib/supabase';
import { ANALYTICS_CONSENT_VERSION, householdProfileSchema } from './contracts';
import type { z } from 'zod';

export type AnalyticsPreference = { granted: boolean; consentVersion: number; decidedAt: string };

export interface AnalyticsGateway {
  read(): Promise<AnalyticsPreference | null>;
  write(granted: boolean): Promise<void>;
  deleteData(): Promise<void>;
}

const cloudGateway: AnalyticsGateway = {
  async read() {
    const { data, error } = await supabase.from('analytics_consents').select('granted, consent_version, decided_at').maybeSingle();
    if (error) throw error;
    return data ? { granted: data.granted, consentVersion: data.consent_version, decidedAt: data.decided_at } : null;
  },
  async write(granted) {
    const account = getSessionSnapshot().account;
    if (!account) throw new Error('Sign in as a parent to change analytics settings.');
    const { error } = await supabase.from('analytics_consents').upsert({
      household_id: account.accountId,
      granted,
      consent_version: ANALYTICS_CONSENT_VERSION,
      decided_at: new Date().toISOString(),
    });
    if (error) throw error;
  },
  async deleteData() {
    const { error } = await supabase.rpc('delete_my_analytics');
    if (error) throw error;
  },
};

export class AnalyticsPreferences {
  constructor(private readonly gateway: AnalyticsGateway = cloudGateway) {}

  isEligible(): boolean { return getSessionSnapshot().status === 'signedIn'; }

  async get(): Promise<AnalyticsPreference> {
    if (!this.isEligible()) return { granted: false, consentVersion: ANALYTICS_CONSENT_VERSION, decidedAt: '' };
    return (await this.gateway.read()) ?? { granted: false, consentVersion: ANALYTICS_CONSENT_VERSION, decidedAt: '' };
  }

  async set(granted: boolean): Promise<void> {
    if (!this.isEligible()) throw new Error('Analytics is unavailable for guest or local-only use.');
    await this.gateway.write(granted);
  }

  async delete(): Promise<void> {
    if (!this.isEligible()) throw new Error('Sign in as a parent to delete analytics data.');
    await this.gateway.deleteData();
  }
}

export const analyticsPreferences = new AnalyticsPreferences();

export type AnalyticsHouseholdProfile = z.infer<typeof householdProfileSchema>;
export async function saveAnalyticsProfile(input: AnalyticsHouseholdProfile): Promise<void> {
  const account = getSessionSnapshot().account;
  if (!account) throw new Error('Sign in as a parent to save optional profile information.');
  const value = householdProfileSchema.parse(input);
  const { error } = await supabase.from('analytics_profiles').upsert({ household_id: account.accountId, child_count_band: value.childCountBand, caregiver_count_band: value.caregiverCountBand, child_age_bands: value.childAgeBands, country_code: value.countryCode, region_code: value.regionCode, updated_at: new Date().toISOString() });
  if (error) throw error;
}
