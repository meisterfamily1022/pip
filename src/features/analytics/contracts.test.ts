import { parseTelemetryEvent } from './contracts';

test('accepts an allowlisted minimal event', () => {
  expect(parseTelemetryEvent({ name: 'toy_added', payload: { appVersion: '1.0.0', platform: 'ios' } }).name).toBe('toy_added');
});

test.each(['toyName', 'searchTerm', 'city', 'stack'])('rejects prohibited or unknown key %s', (key) => {
  expect(() => parseTelemetryEvent({ name: 'toy_added', payload: { appVersion: '1', platform: 'web', [key]: 'private' } })).toThrow();
});

test('rejects unknown events', () => {
  expect(() => parseTelemetryEvent({ name: 'child_clicked', payload: {} })).toThrow();
});

