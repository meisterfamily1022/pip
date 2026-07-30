import { useCallback, useState } from 'react';
import { router, useFocusEffect } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { ToyPhoto } from '@/components/toy-photo';
import { initializeDatabase } from '@/database/client';
import { CameraIcon } from '@/design/icons';
import {
  BackPill,
  ConfirmButton,
  EmptyState,
  ErrorState,
  ErrorText,
  LoadingState,
  LocationLine,
  locationLabel,
  PrimaryButton,
  Screen,
  ScreenTitle,
} from '@/design/primitives';
import { spacing } from '@/design/tokens';
import { finishPlaying, isCleanupRequired, loadCurrentToy, type CurrentToy } from '@/features/play/play-service';

/**
 * The toy the child is playing with right now.
 *
 * V1 keeps exactly one active toy, and it survives closing the app, so this
 * screen re-reads the active session every time it gains focus.
 */

export default function CurrentToyRoute() {
  const [current, setCurrent] = useState<CurrentToy | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [finishing, setFinishing] = useState(false);

  const reload = useCallback(async (): Promise<void> => {
    setLoading(true);
    setError(null);
    try {
      const database = await initializeDatabase();
      setCurrent(await loadCurrentToy(database));
    } catch (caught: unknown) {
      setError(caught instanceof Error ? caught.message : 'Could not load your toy.');
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void reload();
    }, [reload]),
  );

  const donePlaying = async (): Promise<void> => {
    setFinishing(true);
    setError(null);
    try {
      const database = await initializeDatabase();
      if (await isCleanupRequired(database)) {
        router.push('/child/cleanup');
        setFinishing(false);
        return;
      }
      await finishPlaying(database);
      router.replace('/child/home');
    } catch (caught: unknown) {
      setError(caught instanceof Error ? caught.message : 'Could not put this toy away.');
      setFinishing(false);
    }
  };

  return (
    <Screen mode="child">
      <View style={styles.header}>
        <BackPill label="Home" onPress={() => router.navigate('/child/home')} />
      </View>

      {loading ? <LoadingState label="Checking what you are playing with…" /> : null}

      {!loading && error && !current ? (
        <ErrorState
          message={error}
          onRetry={() => {
            void reload();
          }}
        />
      ) : null}

      {!loading && current ? (
        <View style={styles.body}>
          <View style={styles.photoFrame}>
            <ToyPhoto label={current.toy.name} rounded uri={current.toy.imageUri} />
          </View>
          <ScreenTitle style={styles.name}>{current.toy.name}</ScreenTitle>
          <LocationLine label={locationLabel(current.toy.roomName, current.toy.storageSpotName)} />
          {error ? <ErrorText>{error}</ErrorText> : null}
          <ConfirmButton
            disabled={finishing}
            label="Done Playing — Put It Back"
            onPress={() => {
              void donePlaying();
            }}
            style={styles.done}
          />
        </View>
      ) : null}

      {!loading && !error && !current ? (
        <EmptyState
          action={<PrimaryButton label="Find a Toy" onPress={() => router.push('/child/categories')} />}
          icon={CameraIcon}
          title="Nothing is playing right now."
        />
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  body: { alignItems: 'center', gap: spacing.md, paddingTop: spacing.xl },
  done: { marginTop: spacing.lg },
  header: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between', marginBottom: spacing.xl },
  name: { fontSize: 28, lineHeight: 36, textAlign: 'center' },
  photoFrame: { marginBottom: spacing.sm, width: 220 },
});
