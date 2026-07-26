import type { PinStorage } from '@/services/pin-storage';
import { verifyParentPin } from './parent-access';

const storage = (pin: string | null): PinStorage => ({ savePin: jest.fn(), getPin: jest.fn(async () => pin), deletePin: jest.fn() });

describe('parent access', () => {
  it('accepts the current PIN and rejects an incorrect PIN', async () => {
    await expect(verifyParentPin(storage('1234'), '1234')).resolves.toBe(true);
    await expect(verifyParentPin(storage('1234'), '0000')).resolves.toBe(false);
  });
  it('rejects missing PIN storage safely', async () => { await expect(verifyParentPin(storage(null), '1234')).resolves.toBe(false); });
});
