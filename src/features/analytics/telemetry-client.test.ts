import { TelemetryClient, type TelemetryGateway } from './telemetry-client';

test('does not send without consent', async () => {
  const send = jest.fn();
  const client = new TelemetryClient({ send } as TelemetryGateway, { get: async () => ({ granted: false, consentVersion: 1, decidedAt: '' }) } as never);
  await client.track('toy_added');
  expect(send).not.toHaveBeenCalled();
});

test('transport failure never rejects a product action', async () => {
  const client = new TelemetryClient({ send: jest.fn().mockRejectedValue(new Error('offline')) }, { get: async () => ({ granted: true }) } as never);
  await expect(client.track('toy_added')).resolves.toBeUndefined();
});

