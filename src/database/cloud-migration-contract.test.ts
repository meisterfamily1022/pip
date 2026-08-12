import fs from 'node:fs';
import path from 'node:path';

const sql = fs.readFileSync(path.join(process.cwd(), 'supabase/migrations/20260812000000_analytics_entitlements.sql'), 'utf8');
test('cloud migration is additive, RLS protected, consent gated, and free by default', () => {
  expect(sql).not.toMatch(/drop table|truncate|delete from auth\.users/i);
  expect(sql).toContain('enable row level security');
  expect(sql).toContain('analytics_consent_required');
  expect(sql).toContain("default 'free'");
  expect(sql).toContain('plus_launch');
});
