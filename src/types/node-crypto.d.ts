declare module 'node:crypto' {
  export function createHash(algorithm: string): { update(value: string): { digest(encoding: string): string } };
  export function createHmac(algorithm: string, key: string): { update(value: string): { digest(encoding: string): string } };
  export function timingSafeEqual(a: { length: number }, b: { length: number }): boolean;
  export function randomBytes(size: number): { toString(encoding: string): string };
}
declare const Buffer: { from(value: string, encoding?: string): { length: number; toString(encoding: string): string } };
