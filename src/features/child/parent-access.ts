import type { PinStorage } from '@/services/pin-storage';

export async function verifyParentPin(storage: PinStorage, enteredPin: string): Promise<boolean> {
  const storedPin = await storage.getPin();
  return storedPin !== null && storedPin === enteredPin;
}
