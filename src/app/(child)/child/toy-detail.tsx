import { useCallback, useState } from 'react';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

import { ToyPhoto } from '@/components/toy-photo';
import { initializeDatabase } from '@/database/client';
import { LocationArrowIcon, ToyBoxEmptyIcon } from '@/design/icons';
import {
  ConfirmButton,
  EmptyState,
  ErrorState,
  ErrorText,
  Eyebrow,
  LoadingState,
  PrimaryButton,
  Screen,
  ScreenTitle,
  SecondaryButton,
  TintPanel,
} from '@/design/primitives';
import { colors, fontSizes, fonts, spacing } from '@/design/tokens';
import { startPlayingWith } from '@/features/play/play-service';
import { loadToy } from '@/features/toys/toy-service';
import type { ToyWithLocation } from '@/repositories/toys-repository';

/**
 * The location reveal.
 *
 * This is the screen that teaches the child where a toy lives, so the room and
 * storage spot carry the visual weight rather than the chrome around them.
 */

const parseToyId = (raw: string | string[] | undefined): number | null => {
  const value = Array.isArray(raw) ? raw[0] : raw;
  if (value === undefined) return null;
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : null;
};

export default function ChildToyDetailRoute() {
  const params = useLocalSearchParams<{ id?: string }>();
  const toyId = parseToyId(params.id);
  const [toy, setToy] = useState<ToyWithLocation | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);

  const reload = useCallback(async (): Promise<void> => {
    if (toyId === null) {
      setToy(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const database = await initializeDatabase();
      setToy(await loadToy(database, toyId));
    } catch (caught: unknown) {
      setError(caught instanceof Error ? caught.message : 'Could not load this toy.');
    } finally {
      setLoading(false);
    }
  }, [toyId]);

  useFocusEffect(
    useCallback(() => {
      void reload();
    }, [reload]),
  );

  const goBack = (): void => {
    if (router.canGoBack()) router.back();
    else router.replace('/child/categories');
  };

  const foundIt = async (): Promise<void> => {
    if (!toy) return;
    setStarting(true);
    setError(null);
    try {
      const database = await initializeDatabase();
      await startPlayingWith(database, toy.id);
      router.replace('/child/current-toy');
    } catch (caught: unknown) {
      setError(caught instanceof Error ? caught.message : 'Could not start playing with this toy.');
      setStarting(false);
    }
  };

  if (loading) {
    return (
      <Screen mode="child">
        <LoadingState label="Finding your toy…" />
      </Screen>
    );
  }

  if (error && !toy) {
    return (
      <Screen mode="child">
        <ErrorState
          message={error}
          onRetry={() => {
            void reload();
          }}
        />
      </Screen>
    );
  }

  if (!toy) {
    return (
      <Screen mode="child">
        <EmptyState
          action={<PrimaryButton label="Find a Toy" onPress={() => router.replace('/child/categories')} />}
          description="Let's pick another one."
          icon={ToyBoxEmptyIcon}
          title="We can't find that toy."
        />
      </Screen>
    );
  }

  return (
    <Screen mode="child" contentStyle={styles.content}>
      <Eyebrow>GO AND GET IT</Eyebrow>
      <View style={styles.photoFrame}>
        <ToyPhoto label={toy.name} rounded uri={toy.imageUri} />
      </View>
      <ScreenTitle style={styles.name}>{toy.name}</ScreenTitle>

      <TintPanel style={styles.locationPanel} tint="mint">
        <View
          accessible
          accessibilityLabel={`${toy.name} is in the ${toy.roomName}, in the ${toy.storageSpotName}`}
          style={styles.locationRow}
        >
          <Text style={styles.locationPart}>{toy.roomName}</Text>
          <LocationArrowIcon color={colors.greenDeep} size={24} />
          <Text style={styles.locationPart}>{toy.storageSpotName}</Text>
        </View>
      </TintPanel>

      {error ? <ErrorText>{error}</ErrorText> : null}

      <ConfirmButton
        accessibilityLabel={`I found ${toy.name}`}
        disabled={starting}
        label="I Found It"
        onPress={() => {
          void foundIt();
        }}
        style={styles.confirm}
      />
      <SecondaryButton label="Show me something else" onPress={goBack} style={styles.back} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  back: { alignSelf: 'center', minHeight: 52, paddingHorizontal: spacing.xxl },
  confirm: { alignSelf: 'center', minWidth: 260 },
  content: { alignItems: 'center', gap: spacing.lg },
  locationPanel: { alignSelf: 'stretch' },
  locationPart: {
    color: colors.textPrimary,
    fontFamily: fonts.heading,
    fontSize: fontSizes.subheading,
    fontWeight: '700',
    textAlign: 'center',
  },
  locationRow: {
    alignItems: 'center',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
    justifyContent: 'center',
  },
  name: { fontSize: fontSizes.heading, lineHeight: 38, textAlign: 'center' },
  photoFrame: { maxWidth: 300, width: '100%' },
});
