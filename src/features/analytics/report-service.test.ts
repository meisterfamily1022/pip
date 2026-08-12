import { reportToCsv, validateReportRange } from './report-service';

test('validates and caps report dates', () => {
  expect(validateReportRange({ start: '2026-08-01', end: '2026-08-11' })).toBeTruthy();
  expect(() => validateReportRange({ start: '2026-08-11', end: '2026-08-01' })).toThrow();
  expect(() => validateReportRange({ start: '2020-01-01', end: '2026-08-01' })).toThrow();
});
test('CSV renders suppressed cells without their value or count', () => {
  const csv = reportToCsv({ authorized: true, demographics: [{ kind: 'region', value: null, households: null, suppressed: true }] });
  expect(csv).toContain('Insufficient data'); expect(csv).not.toContain('household_id');
});

