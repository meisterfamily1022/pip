import { useEffect, useState } from 'react';
import { ActivityIndicator, Button, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';

import { initializeApp } from '@/startup/initialize-app';

type StartupState = 'loading' | 'error';

export default function StartupScreen() {
  const [state, setState] = useState<StartupState>('loading');
  const [error, setError] = useState<Error | null>(null);

  const start = (): void => {
    setState('loading');
    setError(null);
    initializeApp().then((destination) => router.replace(destination)).catch((caught: unknown) => {
      const startupError = caught instanceof Error ? caught : new Error('App startup failed.');
      setError(startupError);
      setState('error');
    });
  };

  useEffect(() => {
    initializeApp().then((destination) => router.replace(destination)).catch((caught: unknown) => {
      const startupError = caught instanceof Error ? caught : new Error('App startup failed.');
      setError(startupError);
      setState('error');
    });
  }, []);

  if (state === 'loading') return <View style={styles.container}><ActivityIndicator /><Text>Starting PlayMap…</Text></View>;
  return <View style={styles.container}><Text style={styles.errorTitle}>PlayMap could not start.</Text><Text>{error?.message}</Text><Button title="Try again" onPress={start} /></View>;
}

const styles = StyleSheet.create({ container: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16, padding: 24 }, errorTitle: { fontSize: 20, fontWeight: '700' } });
