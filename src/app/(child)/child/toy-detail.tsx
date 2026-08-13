import { useCallback, useEffect, useState } from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { ChildButton, ChildModeHeader, ChildPage, LocationPanel, ToyImage } from '@/components/child-ui';
import { PipIcon } from '@/components/pip-icon';
import { Banner, SkeletonRows } from '@/components/playmap-ui';
import { initializeDatabase } from '@/database/client';
import { displayToyName } from '@/domain/presentation';
import { offersSpokenLabels, readingSupportOf, speakToyName } from '@/features/child/spoken-labels';
import { getActiveChildProfile } from '@/repositories/child-profiles-repository';
import { getActivePlaySession, startPlaySessionIfNoneActive } from '@/repositories/play-sessions-repository';
import { getSettings } from '@/repositories/settings-repository';
import { listChildToys, type ChildToy } from '@/repositories/toys-repository';
import { playmapTheme as theme } from '@/theme/playmap-theme';

/**
 * The chosen toy, and where to find it.
 *
 * One instruction, in the words a child would be given out loud. "I found it!"
 * is what starts the play session — the toy is not checked out until the child
 * actually has it in their hands.
 */
export default function ChildToyDetailRoute() {
  const { id, category: categoryParam, surprise: surpriseParam } = useLocalSearchParams<{ id?: string; category?: string; surprise?: string }>();
  const toyId = Number(id);
  const invalidToyId = !Number.isInteger(toyId) || toyId < 1;
  const [toy, setToy] = useState<ChildToy | null>(null);
  const [speak, setSpeak] = useState(false);
  const [loading, setLoading] = useState(!invalidToyId);
  const [error, setError] = useState<string | null>(invalidToyId ? 'That toy link is not valid.' : null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (invalidToyId) return;
    let active = true;
    void (async () => {
      try {
        const database = await initializeDatabase();
        const settings = await getSettings(database);
        const toys = await listChildToys(database, { childId: settings.activeChildId });
        const found = toys.find((candidate) => candidate.id === toyId) ?? null;
        if (settings.activeChildId !== null) {
          try {
            const profile = await getActiveChildProfile(database);
            if (active) setSpeak(offersSpokenLabels(readingSupportOf(profile.readingSupport)));
          } catch {
            // Fall back to no spoken labels rather than failing the screen.
          }
        }
        if (!active) return;
        setToy(found);
        if (!found) setError('Somebody else is playing with this one right now.');
      } catch (caught: unknown) {
        if (active) setError(caught instanceof Error ? caught.message : 'This toy could not load.');
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, [invalidToyId, toyId]);

  const backToChoices = useCallback((): void => {
    router.replace({
      pathname: '/child/toy-suggestions',
      params: { category: categoryParam ?? 'anything', ...(surpriseParam === '1' ? { surprise: '1' } : {}) },
    });
  }, [categoryParam, surpriseParam]);

  const found = async (): Promise<void> => {
    if (!toy || saving) return;
    setSaving(true);
    setError(null);
    try {
      const database = await initializeDatabase();
      const child = await getActiveChildProfile(database);
      // A child who already has something out keeps it: one toy at a time is
      // the rule, and silently swapping would lose the tidy-up step.
      const active = await getActivePlaySession(database, child.id);
      if (!active) await startPlaySessionIfNoneActive(database, child.id, toy.id);
      router.replace('/child/current-toy');
    } catch (caught: unknown) {
      setError(caught instanceof Error ? caught.message : 'Pip could not start playing.');
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <ChildPage>
        <ChildModeHeader backLabel="Back" onBack={backToChoices} />
        <SkeletonRows label="Loading this toy…" rows={2} />
      </ChildPage>
    );
  }

  if (!toy) {
    return (
      <ChildPage>
        <ChildModeHeader backLabel="Back" onBack={backToChoices} />
        <Text accessibilityRole="header" style={styles.title}>That one is busy</Text>
        <Text style={styles.subtitle}>{error ?? 'Somebody else is playing with this one right now.'}</Text>
          <ChildButton label="Pick another toy" onPress={backToChoices} />
      </ChildPage>
    );
  }

  const toyName = displayToyName(toy.name);

  return (
    <ChildPage
      footer={
        <>
          <ChildButton disabled={saving} label={saving ? 'Just a moment…' : 'I found it!'} onPress={() => { void found(); }} />
          <ChildButton label="Pick another toy" onPress={backToChoices} secondary />
        </>
      }
    >
      <ChildModeHeader backLabel="Back" onBack={backToChoices} />

      {error ? <Banner message={error} tone="alert" /> : null}

      <View style={styles.photoFrame}>
        <ToyImage accessibilityLabel={`${toyName} photo`} uri={toy.imageUri} />
      </View>

      <View style={styles.nameRow}>
        <Text accessibilityRole="header" style={styles.name}>{toyName}</Text>
        {speak ? (
          <Pressable
            accessibilityLabel={`Say the name, ${toyName}`}
            accessibilityRole="button"
            onPress={() => speakToyName(toyName)}
            style={({ pressed }) => [styles.speaker, pressed && styles.pressed]}
          >
            <PipIcon color={theme.colors.brandInk} name="speaker" size={24} />
          </Pressable>
        ) : null}
      </View>

      <LocationPanel room={toy.roomName} spot={toy.storageSpotName} />
    </ChildPage>
  );
}

const styles = StyleSheet.create({
  pressed: { opacity: 0.78 },
  photoFrame: { alignSelf: 'center', borderRadius: theme.radii.sheet, overflow: 'hidden', width: '78%' },
  nameRow: { alignItems: 'center', flexDirection: 'row', gap: theme.spacing[12] },
  name: { color: theme.colors.primaryText, flex: 1, ...theme.typography.childTitle },
  speaker: {
    alignItems: 'center',
    backgroundColor: theme.colors.cardSurface,
    borderColor: theme.colors.border,
    borderRadius: theme.radii.control,
    borderWidth: 1,
    height: 52,
    justifyContent: 'center',
    width: 52,
  },
  title: { color: theme.colors.primaryText, ...theme.typography.childTitle, fontSize: 30, lineHeight: 34 },
  subtitle: { color: theme.colors.secondaryText, ...theme.typography.body },
});
