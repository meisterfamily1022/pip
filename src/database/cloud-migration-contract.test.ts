import fs from 'node:fs';
import path from 'node:path';

const sql = fs.readFileSync(path.join(process.cwd(), 'supabase/migrations/20260812000000_analytics_entitlements.sql'), 'utf8');
const reportingSql = fs.readFileSync(path.join(process.cwd(), 'supabase/migrations/20260812010000_staff_analytics_reporting.sql'), 'utf8');
const rightsSql = fs.readFileSync(path.join(process.cwd(), 'supabase/migrations/20260812020000_analytics_data_rights.sql'), 'utf8');
test('cloud migration is additive, RLS protected, consent gated, and free by default', () => {
  expect(sql).not.toMatch(/drop table|truncate|delete from auth\.users/i);
  expect(sql).toContain('enable row level security');
  expect(sql).toContain('analytics_consent_required');
  expect(sql).toContain("default 'free'");
  expect(sql).toContain('plus_launch');
});
test('deletion preserves core data and retention removes only expired telemetry', () => {
  expect(rightsSql).toContain("interval '13 months'");
  expect(rightsSql).toContain('delete from public.telemetry_events');
  expect(rightsSql).toContain('delete from public.analytics_profiles');
  expect(rightsSql).not.toMatch(/delete from public\.(profiles|household_entitlements)/i);
  expect(rightsSql).toContain('pg_advisory_xact_lock');
});
test('reporting authorizes with an admin claim and suppresses cells under ten households', () => {
  expect(reportingSql).toContain("app_metadata'->>'pip_admin'");
  expect(reportingSql).toContain('households<10');
  expect(reportingSql).toContain('staff_report_audits');
  expect(reportingSql).not.toMatch(/select \* from public\.profiles/i);
});
