import { useCallback, useEffect, useState } from 'react';
import { StyleSheet } from 'react-native';
import { router } from 'expo-router';

import { ErrorState, LoadingState, Screen } from '@/design/primitives';
import { initializeApp } from '@/startup/initialize-app';

type StartupState = 'loading' | 'error';

export default function StartupRoute() {
  const [state, setState] = useState<StartupState>('loading');
  const [error, setError] = useState<Error | null>(null);

  const run = useCallback((): void => {
    initializeApp()
      .then((destination) => router.replace(destination))
      .catch((caught: unknown) => {
        setError(caught instanceof Error ? caught : new Error('App startup failed.'));
        setState('error');
      });
  }, []);

  const retry = useCallback((): void => {
    setState('loading');
    setError(null);
    run();
  }, [run]);

  useEffect(() => {
    run();
  }, [run]);

  return (
    <Screen contentStyle={styles.fill} mode="parent" scroll={false}>
      {state === 'loading' ? (
        <LoadingState label="Starting PlayMap…" />
      ) : (
        <ErrorState
          message={`PlayMap could not start. ${error?.message ?? 'App startup failed.'}`}
          onRetry={retry}
        />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({ fill: { flex: 1 } });
