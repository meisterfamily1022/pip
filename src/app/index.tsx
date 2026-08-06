import { useCallback, useEffect, useState } from 'react';
import { Button, Platform, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';

import { initializeApp } from '@/startup/initialize-app';
import { PipLaunchState } from '@/components/pip-brand-mark';
import { LandingPage } from '@/features/landing/landing-page';

type StartupState = 'loading' | 'error';

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
  const [state, setState] = useState<StartupState>('loading');
  const [error, setError] = useState<Error | null>(null);

  const start = useCallback((): void => {
    setState('loading');
    setError(null);
    initializeApp().then((destination) => router.replace(destination)).catch((caught: unknown) => {
      const startupError = caught instanceof Error ? caught : new Error('App startup failed.');
      setError(startupError);
      setState('error');
    });
  }, []);

  useEffect(() => {
    initializeApp().then((destination) => router.replace(destination)).catch((caught: unknown) => {
      const startupError = caught instanceof Error ? caught : new Error('App startup failed.');
      setError(startupError);
      setState('error');
    });
  }, [start]);

  if (state === 'loading') return <View style={styles.container}><PipLaunchState /></View>;
  return <View style={styles.container}><Text style={styles.errorTitle}>Pip could not start.</Text><Text>{error?.message}</Text><Button title="Try again" onPress={start} /></View>;
}

const styles = StyleSheet.create({ container: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16, padding: 24 }, errorTitle: { fontSize: 20, fontWeight: '700' } });
