import { mayUse, FREE_LAUNCH } from './entitlement-service';

test('launch configuration is disabled and free core is allowed', async () => {
  expect(FREE_LAUNCH).toEqual({ state: 'free', plusEnabled: false, plusVisible: false });
  await expect(mayUse('toy_library')).resolves.toBe(true);
});

