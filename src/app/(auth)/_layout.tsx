import { Stack } from 'expo-router';

/**
 * Account surfaces: create an account, confirm an address, name the household.
 *
 * Reachable whether or not local setup is finished, so a returning parent can
 * sign in on a new device before rebuilding their library.
 */
export default function AuthLayout() {
  return <Stack screenOptions={{ headerShown: false }} />;
}
