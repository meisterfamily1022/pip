import { z } from 'zod';

export const ANALYTICS_CONSENT_VERSION = 1;
export const RAW_EVENT_RETENTION_MONTHS = 13;
export const SMALL_CELL_HOUSEHOLDS = 10;

export const telemetryEventNames = [
  'account_created', 'onboarding_started', 'onboarding_completed', 'consent_decided',
  'first_room', 'first_storage_spot', 'first_toy', 'first_photo', 'first_category',
  'first_child_profile', 'first_play_session', 'first_cleanup', 'session_started',
  'session_completed', 'toy_added', 'toy_edited', 'search_used', 'filter_used',
  'child_mode_entered', 'cleanup_completed', 'library_scale', 'recoverable_error',
  'feature_gate_encountered',
] as const;

export type TelemetryEventName = typeof telemetryEventNames[number];

const band = z.enum(['0', '1', '2', '3', '4-9', '10-24', '25-49', '50+']);
const base = z.object({
  appVersion: z.string().max(32).regex(/^[a-zA-Z0-9._-]+$/),
  platform: z.enum(['ios', 'android', 'web']),
}).strict();

const schemas: Record<TelemetryEventName, z.ZodType> = {
  account_created: base,
  onboarding_started: base,
  onboarding_completed: base,
  consent_decided: base.extend({ granted: z.boolean(), consentVersion: z.number().int().positive() }).strict(),
  first_room: base, first_storage_spot: base, first_toy: base, first_photo: base,
  first_category: base, first_child_profile: base, first_play_session: base, first_cleanup: base,
  session_started: base, session_completed: base,
  toy_added: base, toy_edited: base, search_used: base, filter_used: base,
  child_mode_entered: base, cleanup_completed: base,
  library_scale: base.extend({ toys: band, rooms: band, storageSpots: band, categories: band }).strict(),
  recoverable_error: base.extend({ feature: z.enum(['auth', 'toy', 'play', 'cleanup', 'sync', 'analytics']), errorCode: z.string().max(48).regex(/^[A-Z0-9_]+$/) }).strict(),
  feature_gate_encountered: base.extend({ feature: z.enum(['caregiver_access', 'backup_restore', 'advanced_recommendations', 'routines', 'custom_categories']) }).strict(),
};

export const prohibitedTelemetryKeys = [
  'name', 'childName', 'toyName', 'categoryName', 'query', 'searchTerm', 'photo', 'image',
  'address', 'city', 'postalCode', 'zip', 'latitude', 'longitude', 'ip', 'birthday',
  'diagnosis', 'school', 'therapy', 'message', 'stack', 'email',
] as const;

export function parseTelemetryEvent(input: unknown): { name: TelemetryEventName; payload: Record<string, unknown> } {
  const envelope = z.object({ name: z.enum(telemetryEventNames), payload: z.record(z.string(), z.unknown()) }).strict().parse(input);
  const payload = schemas[envelope.name].parse(envelope.payload) as Record<string, unknown>;
  return { name: envelope.name, payload };
}

export const householdProfileSchema = z.object({
  childCountBand: z.enum(['1', '2', '3', '4+', 'prefer_not_to_say']).nullable(),
  caregiverCountBand: z.enum(['1', '2', '3+', 'prefer_not_to_say']).nullable(),
  childAgeBands: z.array(z.enum(['under_4', '4_6', '7_9', '10_12', '13_plus', 'prefer_not_to_say'])).max(5),
  countryCode: z.string().regex(/^[A-Z]{2}$/).nullable(),
  regionCode: z.string().max(12).regex(/^[A-Z0-9-]+$/).nullable(),
}).strict();

