import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { ParentGreeting, ParentScreen } from '@/components/parent-ui';
import { PipIcon } from '@/components/pip-icon';
import { ProfileAvatar } from '@/components/profile-ui';
import {
  Banner,
  Card,
  ConfirmationDialog,
  SectionHeading,
  SkeletonRows,
  StatCard,
} from '@/components/playmap-ui';
import { ToyPhoto, ToyPhotoCollage, toysWithPhotos } from '@/components/toy-photo';
import { initializeDatabase } from '@/database/client';
import type { ChildProfile } from '@/domain/models';
import { displayChildName, displayToyName, presentLocation } from '@/domain/presentation';
import {
  buildHomeOverview,
  describeRemainingSetup,
  formatElapsed,
  greetingForHour,
  type HomeOverview,
  type SetupStep,
} from '@/features/parent/home-overview';
import { listChildProfiles } from '@/repositories/child-profiles-repository';
import {
  completePlaySession,
  listActivePlaySessions,
  type ActivePlaySession,
} from '@/repositories/play-sessions-repository';
import { countStorageSpots, listRooms } from '@/repositories/rooms-repository';
import { getSettings, markChildModeUsed, setActiveChild } from '@/repositories/settings-repository';
import { countToys, listParentToys, type ParentToy } from '@/repositories/toys-repository';
import { enterChildMode } from '@/startup/route-access';
import { playmapTheme as theme } from '@/theme/playmap-theme';

/**
 * Parent Home.
 *
 * What is out, who has it, and how to get it back — above everything else.
 * Cataloguing lives in the tab bar, so this screen never becomes a menu of
 * places to go.
 */
export default function ParentHomeRoute() {
  const [overview, setOverview] = useState<HomeOverview | null>(null);
  const [libraryToys, setLibraryToys] = useState<ParentToy[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [resolving, setResolving] = useState<ActivePlaySession | null>(null);
  const [busy, setBusy] = useState(false);
  // Sampled when the data loads rather than on every render, so elapsed times
  // are stable within a paint and the render stays pure.
  const [now, setNow] = useState(() => Date.now());

  const load = useCallback(async () => {
    try {
      const database = await initializeDatabase();
      const [children, sessions, toyCount, rooms, settings, toys] = await Promise.all([
        listChildProfiles(database),
        listActivePlaySessions(database),
        countToys(database),
        listRooms(database),
        getSettings(database),
        listParentToys(database),
      ]);
      const spotCounts = await Promise.all(rooms.map((room) => countStorageSpots(database, room.id)));
      setOverview(buildHomeOverview({
        children,
        sessions,
        toyCount,
        roomCount: rooms.length,
        spotCount: spotCounts.reduce((total, count) => total + count, 0),
        childModeUsed: settings.childModeUsed,
      }));
      setLibraryToys(toys);
      setNow(Date.now());
      setError(null);
    } catch (caught: unknown) {
      setError(caught instanceof Error ? caught.message : 'Your home screen could not load.');
    }
  }, []);

  useFocusEffect(useCallback(() => {
    void load();
  }, [load]));

  const handOver = async (child: ChildProfile): Promise<void> => {
    setError(null);
    try {
      const database = await initializeDatabase();
      await setActiveChild(database, child.id);
      await markChildModeUsed(database);
      router.replace('/child/home');
      await enterChildMode();
    } catch (caught: unknown) {
      setError(caught instanceof Error ? caught.message : 'Child mode could not open.');
    }
  };

  const putAway = async (): Promise<void> => {
    if (!resolving) return;
    setBusy(true);
    try {
      const database = await initializeDatabase();
      await completePlaySession(database, resolving.id, resolving.childId);
      setResolving(null);
      await load();
    } catch (caught: unknown) {
      setError(caught instanceof Error ? caught.message : 'That checkout could not be finished.');
      setResolving(null);
    } finally {
      setBusy(false);
    }
  };

  const today = new Date(now);
  const firstChildName = overview?.handoff[0]?.child.name;

  return (
    <ParentScreen tab="home">
      <ParentGreeting
        day={today.toLocaleDateString(undefined, { weekday: 'long' })}
        greeting={greetingForHour(today.getHours())}
      />

      {error ? <Banner message={error} tone="alert" /> : null}

      {!overview ? (
        <SkeletonRows label="Loading your home screen…" rows={3} />
      ) : (
        <>
          {overview.setup ? (
            <Card tone="surface">
              <Text accessibilityRole="header" maxFontSizeMultiplier={1.5} style={styles.cardTitle}>Finish setting up</Text>
              <Text maxFontSizeMultiplier={1.8} style={styles.meta}>{describeRemainingSetup(overview.setup.remaining, firstChildName)}</Text>
              <View style={styles.steps}>
                {overview.setup.steps.map((step) => <SetupRow key={step.id} step={step} />)}
              </View>
            </Card>
          ) : null}

          <View style={styles.section}>
            <SectionHeading
              supporting={overview.checkouts.length > 0
                ? `${overview.checkouts.length} of ${Math.max(overview.handoff.length, overview.checkouts.length)} children`
                : undefined}
              title="Out for play"
            />
            {overview.checkouts.length === 0 ? (
              <View style={styles.emptyCheckouts}>
                <PipIcon color={theme.colors.mutedText} name="check" size={16} />
                <Text maxFontSizeMultiplier={1.8} style={styles.emptyTitle}>Nothing is out right now</Text>
              </View>
            ) : (
              overview.checkouts.map((session) => (
                <View key={session.id} style={styles.checkout}>
                  <ToyPhoto
                    decorative
                    name={session.toy ? displayToyName(session.toy.name) : 'This toy'}
                    style={styles.checkoutPhoto}
                    tier="small"
                    uri={session.toy?.imageUri}
                  />
                  <View style={styles.checkoutCopy}>
                    <Text maxFontSizeMultiplier={1.8} style={styles.checkoutWho}>{`${displayChildName(session.childName)} · ${formatElapsed(session.startedAt, now)}`}</Text>
                    <Text maxFontSizeMultiplier={1.6} numberOfLines={2} style={styles.checkoutToy}>{session.toy ? displayToyName(session.toy.name) : 'This toy is no longer in the library'}</Text>
                    <Text maxFontSizeMultiplier={1.8} style={styles.meta}>
                      {session.toy ? presentLocation(session.toy.roomName, session.toy.storageSpotName).compact ?? 'Location not added' : 'The checkout can still be closed safely.'}
                    </Text>
                  </View>
                  <Pressable
                    accessibilityHint={`Ends ${session.childName}’s turn with this toy`}
                    accessibilityLabel={`Put away ${session.toy?.name ?? 'this toy'} for ${session.childName}`}
                    accessibilityRole="button"
                    onPress={() => setResolving(session)}
                    style={({ pressed }) => [styles.putAway, pressed && styles.pressed]}
                  >
                    <Text maxFontSizeMultiplier={1.6} style={styles.putAwayLabel}>Put away</Text>
                  </Pressable>
                </View>
              ))
            )}
          </View>

          {overview.libraryMilestone ? (
            <Card tone="warm">
              <Text accessibilityRole="header" maxFontSizeMultiplier={1.5} style={styles.cardTitle}>{`Build ${displayChildName(firstChildName, 'your child')}’s toy library`}</Text>
              <Text maxFontSizeMultiplier={1.8} style={styles.meta}>Add a few more toys to give them more choices.</Text>
              <Text maxFontSizeMultiplier={1.6} style={styles.milestoneProgress}>{`${overview.libraryMilestone.count} of ${overview.libraryMilestone.target} ${overview.libraryMilestone.count === 1 ? 'toy' : 'toys'} added`}</Text>
              <Pressable
                accessibilityLabel={overview.libraryMilestone.count === 0 ? 'Add first toy' : 'Add another toy'}
                accessibilityRole="button"
                onPress={() => router.replace(overview.libraryMilestone!.count === 0 ? '/parent/first-toy' : '/parent/add-toy')}
                style={({ pressed }) => [styles.milestoneAction, pressed && styles.pressed]}
              >
                <Text maxFontSizeMultiplier={1.6} style={styles.stepAction}>{overview.libraryMilestone.count === 0 ? 'Add first toy' : 'Add another toy'}</Text>
                <PipIcon color={theme.colors.brandInk} name="chevron-right" size={16} />
              </Pressable>
            </Card>
          ) : null}

          {toysWithPhotos(libraryToys).length > 0 ? (
            <Pressable
              accessibilityHint="Opens the toy library"
              accessibilityLabel={`Your toy shelf. ${overview.toyCount} ${overview.toyCount === 1 ? 'toy' : 'toys'}`}
              accessibilityRole="button"
              onPress={() => router.replace('/parent/toy-library')}
              style={({ pressed }) => [styles.libraryShelf, pressed && styles.pressed]}
            >
              <ToyPhotoCollage
                accessibilityLabel="Photos from your toy library"
                style={styles.libraryCollage}
                toys={toysWithPhotos(libraryToys)}
              />
              <View style={styles.libraryShelfCopy}>
                <View style={styles.rowCopy}>
                  <Text accessibilityRole="header" maxFontSizeMultiplier={1.5} style={styles.cardTitle}>Your toy shelf</Text>
                  <Text maxFontSizeMultiplier={1.8} style={styles.meta}>{`${overview.toyCount} ${overview.toyCount === 1 ? 'toy' : 'toys'} ready for play`}</Text>
                </View>
                <PipIcon color={theme.colors.brandInk} name="chevron-right" size={18} />
              </View>
            </Pressable>
          ) : null}

          <View style={styles.stats}>
            <StatCard label={overview.toyCount === 1 ? 'toy added' : 'toys added'} value={overview.toyCount} />
            <StatCard
              label={`${overview.roomCount === 1 ? 'room' : 'rooms'} · ${overview.spotCount} ${overview.spotCount === 1 ? 'spot' : 'spots'}`}
              value={overview.roomCount}
            />
          </View>

          <View style={styles.section}>
            <SectionHeading title="Ready to play?" />
            {overview.handoff.length === 0 ? (
              <Pressable
                accessibilityHint="Guest play works without a profile"
                accessibilityLabel="Start Child mode"
                accessibilityRole="button"
                onPress={() => router.replace('/parent/select-child')}
                style={({ pressed }) => [styles.startChildMode, pressed && styles.pressed]}
              >
                <View style={styles.rowCopy}>
                  <Text maxFontSizeMultiplier={1.5} style={styles.cardTitle}>Start Child mode</Text>
                  <Text maxFontSizeMultiplier={1.8} style={styles.meta}>Choose who is playing</Text>
                </View>
                <PipIcon color={theme.colors.brandInk} name="chevron-right" size={18} />
              </Pressable>
            ) : (
              <View style={styles.handoff}>
                {overview.handoff.map(({ child, playing }) => (
                  <Pressable
                    accessibilityHint={playing ? 'Already has a toy out' : 'Opens Child mode for this child'}
                    accessibilityLabel={`${displayChildName(child.name)}. ${playing ? 'Playing now' : 'Ready to play'}`}
                    accessibilityRole="button"
                    key={child.id}
                    onPress={() => {
                      void handOver(child);
                    }}
                    style={({ pressed }) => [styles.handoffCard, pressed && styles.pressed]}
                  >
                    <ProfileAvatar accentColorId={child.accentColorId} avatarId={child.avatarId} decorative size={48} />
                    <Text maxFontSizeMultiplier={1.6} style={styles.handoffName}>{displayChildName(child.name)}</Text>
                    <Text maxFontSizeMultiplier={1.8} style={[styles.handoffState, playing && styles.handoffPlaying]}>{playing ? 'Playing now' : 'Ready'}</Text>
                  </Pressable>
                ))}
              </View>
            )}
          </View>
        </>
      )}

      <ConfirmationDialog
        busy={busy}
        cancelLabel="Not yet"
        confirmLabel="Put it away"
        message={`${resolving?.childName ?? 'This child'} will no longer have ${resolving?.toy?.name ?? 'this toy'} out. The toy and its play history stay exactly as they are.`}
        onCancel={() => setResolving(null)}
        onConfirm={() => {
          void putAway();
        }}
        title="Finished with this toy?"
        visible={resolving !== null}
      />
    </ParentScreen>
  );
}

function SetupRow({ step }: { step: SetupStep }) {
  const content = (
    <>
      <View style={[styles.stepMark, step.done && styles.stepMarkDone]}>
        {step.done ? <PipIcon color={theme.colors.success} name="check" size={12} strokeWidth={3} /> : null}
      </View>
      <Text maxFontSizeMultiplier={1.6} style={[styles.stepLabel, step.done && styles.stepLabelDone]}>{step.label}</Text>
      {!step.done && step.href ? (
        <>
          <Text maxFontSizeMultiplier={1.6} style={styles.stepAction}>{step.actionLabel}</Text>
          <PipIcon color={theme.colors.brandInk} name="chevron-right" size={16} />
        </>
      ) : null}
    </>
  );
  if (step.done || !step.href) {
    return <View accessibilityLabel={`${step.label}. Done`} accessible style={styles.step}>{content}</View>;
  }
  return (
    <Pressable
      accessibilityLabel={`${step.label}. Not done yet`}
      accessibilityRole="button"
      onPress={() => router.replace(step.href as never)}
      style={({ pressed }) => [styles.step, pressed && styles.pressed]}
    >
      {content}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pressed: { opacity: 0.72 },
  section: { gap: theme.spacing[8] },
  rowCopy: { flex: 1, gap: 2 },
  cardTitle: { color: theme.colors.primaryText, ...theme.typography.rowTitle },
  meta: { color: theme.colors.secondaryText, ...theme.typography.meta },
  milestoneProgress: { color: theme.colors.primaryText, ...theme.typography.label },
  milestoneAction: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between', minHeight: theme.measurements.minimumTouchTarget },

  steps: { gap: theme.spacing[4], marginTop: theme.spacing[4] },
  step: { alignItems: 'center', flexDirection: 'row', gap: theme.spacing[12], minHeight: theme.measurements.minimumTouchTarget },
  stepMark: {
    alignItems: 'center',
    borderColor: theme.colors.neutralBorder,
    borderRadius: theme.radii.pill,
    borderWidth: 1.5,
    height: 22,
    justifyContent: 'center',
    width: 22,
  },
  stepMarkDone: { backgroundColor: theme.colors.successMark, borderColor: theme.colors.successMark },
  stepLabel: { color: theme.colors.primaryText, flex: 1, ...theme.typography.label, fontSize: 14 },
  stepLabelDone: { color: theme.colors.secondaryText, fontFamily: theme.fonts.regular },
  stepAction: { color: theme.colors.brandInk, ...theme.typography.label, fontSize: 14 },

  // Compact and quiet: "nothing is out" is the normal case and should not be
  // the largest thing on the parent's home screen.
  emptyCheckouts: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: theme.spacing[8],
    paddingVertical: theme.spacing[8],
  },
  emptyTitle: { color: theme.colors.secondaryText, ...theme.typography.meta },
  checkoutPhoto: { borderRadius: theme.radii.card, height: 64, minHeight: 0, width: 64 },
  checkout: {
    alignItems: 'center',
    backgroundColor: theme.colors.cardSurface,
    borderColor: theme.colors.border,
    borderRadius: theme.radii.card,
    borderWidth: 1,
    flexDirection: 'row',
    gap: theme.spacing[12],
    padding: theme.spacing[12],
  },
  checkoutCopy: { flex: 1, gap: 1 },
  checkoutWho: { color: theme.colors.brandInk, ...theme.typography.eyebrow, letterSpacing: 0 },
  checkoutToy: { color: theme.colors.primaryText, ...theme.typography.label, fontSize: 15 },
  putAway: {
    alignItems: 'center',
    borderColor: theme.colors.brandInk,
    borderRadius: theme.radii.control,
    borderWidth: 1.5,
    justifyContent: 'center',
    minHeight: theme.measurements.minimumTouchTarget,
    paddingHorizontal: theme.spacing[12],
  },
  putAwayLabel: { color: theme.colors.brandInk, ...theme.typography.label, fontSize: 14 },

  stats: { flexDirection: 'row', gap: theme.spacing[12] },
  libraryShelf: {
    backgroundColor: theme.colors.cardSurface,
    borderColor: theme.colors.border,
    borderRadius: theme.radii.card,
    borderWidth: 1,
    overflow: 'hidden',
  },
  libraryCollage: { aspectRatio: 2.25, borderRadius: 0 },
  libraryShelfCopy: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: theme.spacing[12],
    minHeight: theme.measurements.minimumTouchTarget,
    padding: theme.spacing[12],
  },

  startChildMode: {
    alignItems: 'center',
    backgroundColor: theme.colors.selectedSurface,
    borderColor: theme.colors.infoBorder,
    borderRadius: theme.radii.card,
    borderWidth: 1,
    flexDirection: 'row',
    gap: theme.spacing[12],
    minHeight: 64,
    padding: theme.spacing[16],
  },
  handoff: { flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing[8] },
  handoffCard: {
    alignItems: 'center',
    backgroundColor: theme.colors.cardSurface,
    borderColor: theme.colors.border,
    borderRadius: theme.radii.card,
    borderWidth: 1,
    flexBasis: '46%',
    flexGrow: 1,
    gap: 5,
    paddingHorizontal: theme.spacing[8],
    paddingVertical: theme.spacing[12],
  },
  handoffName: { color: theme.colors.primaryText, ...theme.typography.label, fontSize: 14 },
  handoffState: { color: theme.colors.mutedText, ...theme.typography.caption },
  handoffPlaying: { color: theme.colors.brandInk, fontFamily: theme.fonts.bold },
});
