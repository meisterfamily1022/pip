import { useCallback, useState } from 'react';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { ToyPhoto } from '@/components/toy-photo';
import { initializeDatabase } from '@/database/client';
import { SparkleIcon, ToyBoxEmptyIcon } from '@/design/icons';
import {
  BackPill,
  Card,
  EmptyState,
  ErrorState,
  Eyebrow,
  LoadingState,
  LocationLine,
  locationLabel,
  PrimaryButton,
  Screen,
  ScreenTitle,
} from '@/design/primitives';
import { colors, fontSizes, fonts, radii, spacing } from '@/design/tokens';
import { ANYTHING_CHOICE_ID, findPlayChoice } from '@/features/play/play-choices';
import { loadSuggestions } from '@/features/play/play-service';
import type { ToyWithLocation } from '@/repositories/toys-repository';

/**
 * The toy ideas a child picks from after choosing a kind of play.
 *
 * `loadSuggestions` already caps the list at the parent's choice limit, so this
 * screen renders whatever comes back without trimming it again.
 */

const toyLocation = (toy: ToyWithLocation): string => locationLabel(toy.roomName, toy.storageSpotName);

export default function ChildToySuggestionsRoute() {
  const params = useLocalSearchParams<{ choice?: string }>();
  const choice = findPlayChoice(typeof params.choice === 'string' ? params.choice : undefined);
  const [toys, setToys] = useState<ToyWithLocation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async (): Promise<void> => {
    setLoading(true);
    setError(null);
    try {
      const database = await initializeDatabase();
      setToys(await loadSuggestions(database, choice.category));
    } catch (caught: unknown) {
      setError(caught instanceof Error ? caught.message : 'Could not load toy ideas.');
    } finally {
      setLoading(false);
    }
  }, [choice.category]);

  useFocusEffect(
    useCallback(() => {
      void reload();
    }, [reload]),
  );

  const showAnything = (): void => {
    router.replace({ pathname: '/child/toy-suggestions', params: { choice: ANYTHING_CHOICE_ID } });
  };

  return (
    <Screen mode="child">
      <View style={styles.header}>
        <BackPill label="Play types" onPress={() => router.navigate('/child/categories')} />
        <View style={styles.modeMarker}>
          <SparkleIcon size={13} color={colors.terracotta} />
          <Text style={styles.modeMarkerText}>CHILD MODE</Text>
        </View>
      </View>
      <Eyebrow>TOY IDEAS</Eyebrow>

      {loading ? <LoadingState label="Finding toy ideas…" /> : null}

      {!loading && error ? (
        <ErrorState
          message={error}
          onRetry={() => {
            void reload();
          }}
        />
      ) : null}

      {!loading && !error ? (
        <>
          {toys.length > 0 ? (
            <>
              <ScreenTitle style={styles.heading}>{`Toys for ${choice.label.toLowerCase()}`}</ScreenTitle>
              <View style={styles.list}>
                {toys.map((toy) => (
                  <Card key={toy.id} style={styles.toyCard}>
                    <ToyPhoto uri={toy.imageUri} label={toy.name} />
                    <View style={styles.toyBody}>
                      <Text style={styles.toyName}>{toy.name}</Text>
                      <LocationLine label={toyLocation(toy)} />
                      <PrimaryButton
                        accessibilityLabel={`Play with ${toy.name}`}
                        label="Play With This"
                        onPress={() => router.push({ pathname: '/child/toy-detail', params: { id: toy.id } })}
                        style={styles.playButton}
                      />
                    </View>
                  </Card>
                ))}
              </View>
            </>
          ) : (
            <EmptyState
              description="Try another kind of play."
              icon={ToyBoxEmptyIcon}
              title="No toys match this choice yet."
            />
          )}

          {choice.id === ANYTHING_CHOICE_ID ? null : (
            <Pressable
              accessibilityLabel="Show Me Anything"
              accessibilityRole="button"
              onPress={showAnything}
              style={({ pressed }) => [styles.anythingButton, pressed && styles.pressed]}
            >
              <Text style={styles.anythingButtonText}>Show Me Anything</Text>
            </Pressable>
          )}
        </>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  anythingButton: {
    alignItems: 'center',
    backgroundColor: colors.butter,
    borderRadius: radii.control,
    justifyContent: 'center',
    marginTop: spacing.lg,
    minHeight: 60,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.lg,
  },
  anythingButtonText: { color: colors.textPrimary, fontSize: 17, fontWeight: '700' },
  header: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between', marginBottom: spacing.xl },
  heading: { fontSize: fontSizes.heading, lineHeight: 38, marginBottom: spacing.xl, marginTop: spacing.sm },
  list: { gap: 18 },
  modeMarker: { alignItems: 'center', flexDirection: 'row', gap: 5 },
  modeMarkerText: { color: colors.terracotta, fontSize: fontSizes.badge, fontWeight: '800', letterSpacing: 1 },
  playButton: { marginTop: spacing.sm },
  pressed: { opacity: 0.75 },
  toyBody: { flex: 1, gap: spacing.sm, padding: spacing.lg },
  toyCard: { overflow: 'hidden', padding: 0 },
  toyName: { color: colors.textPrimary, fontFamily: fonts.heading, fontSize: fontSizes.sectionTitle, fontWeight: '700' },
});
