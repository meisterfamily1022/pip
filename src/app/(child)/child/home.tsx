import { useCallback, useState } from 'react';
import { router, useFocusEffect } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

import { initializeDatabase } from '@/database/client';
import { CameraIcon, ChildHeroIcon, DiceIcon, SearchIcon } from '@/design/icons';
import {
  DisplayTitle,
  ErrorState,
  HeroCard,
  LoadingState,
  NavCard,
  Screen,
  TextLink,
} from '@/design/primitives';
import { colors, radii, spacing } from '@/design/tokens';
import { ANYTHING_CHOICE_ID } from '@/features/play/play-choices';
import { loadCurrentToy, type CurrentToy } from '@/features/play/play-service';
import { getSettings } from '@/repositories/settings-repository';

/** Warm greeting used before the parent has set a nickname. */
const GENERIC_GREETING = 'Hi there';

const heroGradient = [colors.sage, colors.mint] as const;

type Status = 'loading' | 'ready' | 'error';

export default function ChildHomeRoute() {
  const [status, setStatus] = useState<Status>('loading');
  const [nickname, setNickname] = useState<string | null>(null);
  const [currentToy, setCurrentToy] = useState<CurrentToy | null>(null);

  const load = useCallback(async (): Promise<void> => {
    try {
      const database = await initializeDatabase();
      const [settings, playing] = await Promise.all([getSettings(database), loadCurrentToy(database)]);
      setNickname(settings.childNickname);
      setCurrentToy(playing);
      setStatus('ready');
    } catch {
      setStatus('error');
    }
  }, []);

  // Refreshes on focus so "My current toy" is right after the child picks one.
  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const retry = (): void => {
    setStatus('loading');
    void load();
  };

  if (status === 'loading') {
    return (
      <Screen mode="child" scroll={false} contentStyle={styles.fill}>
        <LoadingState label="Getting your toys ready…" />
      </Screen>
    );
  }

  if (status === 'error') {
    return (
      <Screen mode="child" scroll={false} contentStyle={styles.fill}>
        <ErrorState message="We could not open your toys just now." onRetry={retry} />
      </Screen>
    );
  }

  const greeting = nickname ? `Hi, ${nickname}` : GENERIC_GREETING;

  return (
    <Screen mode="child">
      <Text style={styles.greeting}>{greeting}</Text>
      <DisplayTitle>What feels fun today?</DisplayTitle>

      <HeroCard colors={heroGradient} style={styles.hero}>
        <ChildHeroIcon size={46} />
        <View style={styles.heroDot} />
      </HeroCard>

      <View style={styles.cards}>
        <NavCard
          icon={SearchIcon}
          onPress={() => router.push('/child/categories')}
          subtitle="Choose what sounds good"
          tint="sage"
          title="Find a toy"
        />
        <NavCard
          icon={DiceIcon}
          onPress={() =>
            router.push({ pathname: '/child/toy-suggestions', params: { choice: ANYTHING_CHOICE_ID } })
          }
          subtitle="Let PlayMap choose"
          tint="butter"
          title="Surprise me"
        />
        <NavCard
          icon={CameraIcon}
          onPress={() => router.push('/child/current-toy')}
          subtitle={currentToy ? currentToy.toy.name : 'Nothing is playing right now'}
          tint="peach"
          title="My current toy"
        />
      </View>

      <View style={styles.link}>
        <TextLink label="Grown-up area" onPress={() => router.push('/child/parent-gate')} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  cards: { gap: spacing.lg },
  fill: { flex: 1 },
  greeting: { color: colors.textPrimary, fontSize: 17, fontWeight: '700', marginBottom: 6 },
  hero: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.xl,
    marginTop: spacing.xxl,
  },
  heroDot: { backgroundColor: colors.accentYellow, borderRadius: radii.pill, height: 44, width: 44 },
  link: { marginTop: spacing.xxxl },
});
