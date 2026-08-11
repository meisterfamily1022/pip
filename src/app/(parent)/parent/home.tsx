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
  ImageTile,
  SectionHeading,
  SkeletonRows,
  StatCard,
} from '@/components/playmap-ui';
import { initializeDatabase } from '@/database/client';
import type { ChildProfile } from '@/domain/models';
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
  hasEverPlayed,
  listActivePlaySessions,
  type ActivePlaySession,
} from '@/repositories/play-sessions-repository';
import { countStorageSpots, listRooms } from '@/repositories/rooms-repository';
import { setActiveChild } from '@/repositories/settings-repository';
import { countToys } from '@/repositories/toys-repository';
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
  const [error, setError] = useState<string | null>(null);
  const [resolving, setResolving] = useState<ActivePlaySession | null>(null);
  const [busy, setBusy] = useState(false);
  // Sampled when the data loads rather than on every render, so elapsed times
  // are stable within a paint and the render stays pure.
  const [now, setNow] = useState(() => Date.now());

  const load = useCallback(async () => {
    try {
      const database = await initializeDatabase();
      const [children, sessions, toyCount, rooms, childModeUsed] = await Promise.all([
        listChildProfiles(database),
        listActivePlaySessions(database),
        countToys(database),
        listRooms(database),
        hasEverPlayed(database),
      ]);
      const spotCounts = await Promise.all(rooms.map((room) => countStorageSpots(database, room.id)));
      setOverview(buildHomeOverview({
        children,
        sessions,
        toyCount,
        roomCount: rooms.length,
        spotCount: spotCounts.reduce((total, count) => total + count, 0),
        childModeUsed,
      }));
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
      router.replace('/child/home');
      await enterChildMode();
    } catch (caught: unknown) {
      setError(caught instanceof Error ? caught.message : 'Child Mode could not open.');
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
              <Text accessibilityRole="header" style={styles.cardTitle}>Finish setting up</Text>
              <Text style={styles.meta}>{describeRemainingSetup(overview.setup.remaining, firstChildName)}</Text>
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
                <Text style={styles.emptyTitle}>Nothing is out right now</Text>
                <Text style={styles.meta}>When a child picks a toy, it appears here with their name.</Text>
              </View>
            ) : (
              overview.checkouts.map((session) => (
                <View key={session.id} style={styles.checkout}>
                  <ImageTile label={`${session.toy?.name ?? 'Toy'} photo`} size={56} uri={session.toy?.imageUri} />
                  <View style={styles.checkoutCopy}>
                    <Text style={styles.checkoutWho}>{`${session.childName} · ${formatElapsed(session.startedAt, now)}`}</Text>
                    <Text numberOfLines={2} style={styles.checkoutToy}>{session.toy?.name ?? 'This toy is no longer in the library'}</Text>
                    <Text numberOfLines={1} style={styles.meta}>
                      {session.toy ? `${session.toy.roomName} · ${session.toy.storageSpotName}` : 'The checkout can still be closed safely.'}
                    </Text>
                  </View>
                  <Pressable
                    accessibilityHint={`Ends ${session.childName}’s turn with this toy`}
                    accessibilityLabel={`Put away ${session.toy?.name ?? 'this toy'} for ${session.childName}`}
                    accessibilityRole="button"
                    onPress={() => setResolving(session)}
                    style={({ pressed }) => [styles.putAway, pressed && styles.pressed]}
                  >
                    <Text style={styles.putAwayLabel}>Put away</Text>
                  </Pressable>
                </View>
              ))
            )}
          </View>

          <View style={styles.stats}>
            <StatCard label={overview.toyCount === 1 ? 'toy catalogued' : 'toys catalogued'} value={overview.toyCount} />
            <StatCard
              label={`${overview.roomCount === 1 ? 'room' : 'rooms'} · ${overview.spotCount} ${overview.spotCount === 1 ? 'spot' : 'spots'}`}
              value={overview.roomCount}
            />
          </View>

          <View style={styles.section}>
            <SectionHeading title="Hand the phone over" />
            {overview.handoff.length === 0 ? (
              <Pressable
                accessibilityHint="Guest play works without a profile"
                accessibilityLabel="Start Child Mode"
                accessibilityRole="button"
                onPress={() => router.replace('/parent/select-child')}
                style={({ pressed }) => [styles.startChildMode, pressed && styles.pressed]}
              >
                <View style={styles.rowCopy}>
                  <Text style={styles.cardTitle}>Start Child Mode</Text>
                  <Text style={styles.meta}>Choose who is playing</Text>
                </View>
                <PipIcon color={theme.colors.brandInk} name="chevron-right" size={18} />
              </Pressable>
            ) : (
              <View style={styles.handoff}>
                {overview.handoff.map(({ child, playing }) => (
                  <Pressable
                    accessibilityHint={playing ? 'Already has a toy out' : 'Opens Child Mode for this child'}
                    accessibilityLabel={`${child.name}. ${playing ? 'Playing' : 'Free'}`}
                    accessibilityRole="button"
                    key={child.id}
                    onPress={() => {
                      void handOver(child);
                    }}
                    style={({ pressed }) => [styles.handoffCard, pressed && styles.pressed]}
                  >
                    <ProfileAvatar accentColorId={child.accentColorId} avatarId={child.avatarId} decorative size={48} />
                    <Text numberOfLines={1} style={styles.handoffName}>{child.name}</Text>
                    <Text style={[styles.handoffState, playing && styles.handoffPlaying]}>{playing ? 'Playing' : 'Free'}</Text>
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
      <Text style={[styles.stepLabel, step.done && styles.stepLabelDone]}>{step.label}</Text>
      {!step.done && step.href ? (
        <>
          <Text style={styles.stepAction}>{step.actionLabel}</Text>
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

  emptyCheckouts: {
    borderColor: theme.colors.dashedBorder,
    borderRadius: theme.radii.card,
    borderStyle: 'dashed',
    borderWidth: 1,
    gap: 2,
    padding: theme.spacing[16],
  },
  emptyTitle: { color: theme.colors.primaryText, ...theme.typography.label, fontSize: 14 },
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
    flexBasis: '30%',
    flexGrow: 1,
    gap: 5,
    paddingHorizontal: theme.spacing[8],
    paddingVertical: theme.spacing[12],
  },
  handoffName: { color: theme.colors.primaryText, ...theme.typography.label, fontSize: 14 },
  handoffState: { color: theme.colors.mutedText, ...theme.typography.caption },
  handoffPlaying: { color: theme.colors.brandInk, fontFamily: theme.fonts.bold },
});
