import { supabase } from '@/lib/supabase';

export type ReportRange = { start: string; end: string };
export type AnalyticsReport = { authorized: boolean; timezone?: 'UTC'; range?: ReportRange; totals?: { households: number; events: number }; funnel?: { event_name: string; households: number }[]; active?: { dau: number; wau: number; mau: number }; engagement?: { play_sessions: number; cleanup_completions: number }; demographics?: { kind: string; value: string | null; households: number | null; suppressed: boolean }[]; health?: { feature: string; error_code: string; total: number }[]; entitlements?: { state: string; households: number }[] };

export function validateReportRange(range: ReportRange): ReportRange {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(range.start) || !/^\d{4}-\d{2}-\d{2}$/.test(range.end)) throw new Error('Use YYYY-MM-DD dates.');
  const days = (Date.parse(`${range.end}T00:00:00Z`) - Date.parse(`${range.start}T00:00:00Z`)) / 86400000;
  if (!Number.isFinite(days) || days < 0 || days > 366) throw new Error('Choose a range of 367 days or less.');
  return range;
}

export async function loadStaffReport(range: ReportRange, action: 'view'|'export' = 'view'): Promise<AnalyticsReport> {
  validateReportRange(range);
  const { data, error } = await supabase.rpc('staff_analytics_report', { range_start: range.start, range_end: range.end, access_action: action });
  if (error) throw new Error('Report could not be loaded.');
  if (!data?.authorized) throw new Error('Staff authorization required.');
  return data as AnalyticsReport;
}

const csvCell = (value: unknown) => `"${String(value ?? '').replaceAll('"','""')}"`;
export function reportToCsv(report: AnalyticsReport): string {
  const rows: unknown[][] = [['section','metric','value','households','suppressed']];
  for (const item of report.funnel ?? []) rows.push(['funnel', item.event_name, '', item.households, false]);
  for (const [metric,value] of Object.entries(report.active ?? {})) rows.push(['active', metric, value, '', false]);
  for (const [metric,value] of Object.entries(report.engagement ?? {})) rows.push(['engagement', metric, value, '', false]);
  for (const item of report.demographics ?? []) rows.push(['demographic', item.kind, item.suppressed ? 'Insufficient data' : item.value, item.suppressed ? '' : item.households, item.suppressed]);
  for (const item of report.health ?? []) rows.push(['health', `${item.feature}:${item.error_code}`, item.total, '', false]);
  for (const item of report.entitlements ?? []) rows.push(['entitlement', item.state, '', item.households, false]);
  return rows.map((row) => row.map(csvCell).join(',')).join('\n');
}

