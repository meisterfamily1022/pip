import { useCallback, useState } from 'react';
import { router, useFocusEffect } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

import { ChildButton, ChildModeHeader, ChildPage, LocationPanel, ToyImage } from '@/components/child-ui';
import { Banner, SkeletonRows } from '@/components/playmap-ui';
import { initializeDatabase } from '@/database/client';
import { displayChildName, displayToyName } from '@/domain/presentation';
import { getActiveChildProfile } from '@/repositories/child-profiles-repository';
import { getActivePlaySession, type ActivePlaySession } from '@/repositories/play-sessions-repository';
import { getSettings } from '@/repositories/settings-repository';
import { playmapTheme as theme } from '@/theme/playmap-theme';

/**
 * The toy that is currently out.
 *
 * This is also the recovery screen: if the app was closed mid-play, the session
 * is still in the database and the child lands back here with a plain welcome
 * rather than an empty home screen and a toy they have already got out.
 */
export default function CurrentToyRoute() {
  const [session, setSession] = useState<ActivePlaySession | null>(null);
  const [cleanupRequired, setCleanupRequired] = useState(true);
  const [resumed, setResumed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const database = await initializeDatabase();
      const [child, settings] = await Promise.all([getActiveChildProfile(database), getSettings(database)]);
      const active = await getActivePlaySession(database, child.id);
      setSession(active);
      setCleanupRequired(settings.cleanupRequired);
      // A session that started before this launch means the app was closed
      // while the toy was out; that is worth acknowledging once.
      setResumed(active !== null && Date.parse(active.startedAt) < Date.now() - 60_000);
      setError(null);
    } catch (caught: unknown) {
      setError(caught instanceof Error ? caught.message : 'Pip could not find your toy.');
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => {
    void load();
  }, [load]));

  if (loading) {
    return (
      <ChildPage>
        <ChildModeHeader backLabel="Back" onBack={() => router.replace('/child/home')} />
        <SkeletonRows label="Finding your toy…" rows={2} />
      </ChildPage>
    );
  }

  if (error || !session?.toy) {
    return (
      <ChildPage>
        <ChildModeHeader backLabel="Back" onBack={() => router.replace('/child/home')} />
        {error ? <Banner message={error} tone="alert" /> : null}
        <Text accessibilityRole="header" style={styles.title}>Nothing is out right now</Text>
        <Text style={styles.subtitle}>Pick a toy whenever you are ready.</Text>
        <ChildButton label="Pick a toy" onPress={() => router.replace('/child/categories')} />
      </ChildPage>
    );
  }

  const toy = session.toy;
  const toyName = displayToyName(toy.name);

  return (
    <ChildPage
      footer={
        <>
          <ChildButton label="I’m done playing" onPress={() => router.push('/child/cleanup')} />
          <ChildButton
            label={cleanupRequired ? 'Pick another toy — tidy up first' : 'Pick another toy'}
            onPress={() => router.push(cleanupRequired ? '/child/cleanup' : '/child/categories')}
            secondary
          />
        </>
      }
    >
      <ChildModeHeader backLabel="Back" onBack={() => router.replace('/child/home')} />

      {resumed ? (
        <Banner message={`Welcome back, ${displayChildName(session.childName)}. You still have this toy out.`} tone="info" />
      ) : null}

      <View style={styles.photoFrame}>
        <ToyImage accessibilityLabel={`${toyName} photo`} uri={toy.imageUri} />
      </View>

      <View style={styles.copy}>
        <Text style={styles.lead}>You’re playing with</Text>
        <Text accessibilityRole="header" style={styles.name}>{toyName}</Text>
      </View>

      <LocationPanel room={toy.roomName} spot={toy.storageSpotName} />
    </ChildPage>
  );
}

const styles = StyleSheet.create({
  photoFrame: { alignSelf: 'center', borderRadius: theme.radii.sheet, overflow: 'hidden', width: '70%' },
  copy: { gap: 2 },
  lead: { color: theme.colors.secondaryText, ...theme.typography.body },
  name: { color: theme.colors.primaryText, ...theme.typography.childTitle },
  title: { color: theme.colors.primaryText, ...theme.typography.childTitle, fontSize: 30, lineHeight: 34 },
  subtitle: { color: theme.colors.secondaryText, ...theme.typography.body },
});
