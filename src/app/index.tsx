import { Platform, StyleSheet, View } from 'react-native';

import { PipLaunchState } from '@/components/pip-brand-mark';
import { LandingPage } from '@/features/landing/landing-page';

/**
 * The root route serves two audiences.
 *
 * On the web it is the public landing page, so a visitor who has never used Pip
 * lands on marketing rather than an app loader. In the native app the same path
 * is startup, which opens the local database and routes onward.
 */
export default function RootRoute() {
  if (Platform.OS === 'web') return <LandingPage />;
  return <StartupScreen />;
}

function StartupScreen() {
  // RootLayout owns the sole startup decision and replaces this waypoint once
  // route access, session restoration, and pending verification are resolved.
  return <View style={styles.container}><PipLaunchState /></View>;
}

const styles = StyleSheet.create({ container: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16, padding: 24 } });
