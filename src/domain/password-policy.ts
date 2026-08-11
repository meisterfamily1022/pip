/**
 * The one password rule the product enforces, stated once.
 *
 * This lives in `domain` rather than beside the hashing code because the sign-up
 * form needs it too, and the hashing module imports `node:crypto`. Importing it
 * from a screen dragged Node's crypto into the native bundle, which does not
 * exist there — the iOS export failed on it. Nothing in this file may import
 * anything that is not available on device.
 */
export const MINIMUM_PASSWORD_LENGTH = 10;

/** True when the password satisfies the only rule the product enforces. */
export function isAcceptablePassword(password: string): boolean {
  return password.length >= MINIMUM_PASSWORD_LENGTH;
}
