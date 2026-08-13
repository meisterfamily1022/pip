import { useEffect, useState } from 'react';
import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { PipIcon } from '@/components/pip-icon';
import { ProfileAvatar } from '@/components/profile-ui';
import {
  Banner,
  BackNavigation,
  PageShell,
  PrimaryButton,
  SkeletonRows,
} from '@/components/playmap-ui';
import { initializeDatabase } from '@/database/client';
import type { ChildProfile } from '@/domain/models';
import { listChildProfiles } from '@/repositories/child-profiles-repository';
import { clearActiveChild, markChildModeUsed, setActiveChild } from '@/repositories/settings-repository';
import { enterChildMode } from '@/startup/route-access';
import { playmapTheme as theme } from '@/theme/playmap-theme';

/** Guest is a real choice, not a fallback, so it sits in the grid with the rest. */
const GUEST = 'guest' as const;
type Choice = number | typeof GUEST;

/**
 * The hand-off.
 *
 * The last screen a parent sees before the phone changes hands, so the chosen
 * name is confirmed in the button rather than the tap being final on contact.
 */
export default function SelectChildRoute() {
  const [children, setChildren] = useState<ChildProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [choice, setChoice] = useState<Choice | null>(null);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    initializeDatabase()
      .then(listChildProfiles)
      .then((profiles) => {
        setChildren(profiles);
        setChoice(profiles[0]?.id ?? GUEST);
      })
      .catch((caught: unknown) => setError(caught instanceof Error ? caught.message : 'Child profiles could not load.'))
      .finally(() => setLoading(false));
  }, []);

  const start = async (): Promise<void> => {
    if (choice === null) return;
    setError(null);
    setStarting(true);
    try {
      const database = await initializeDatabase();
      // Guest play records no active child, so a visiting friend leaves no
      // permanent data behind and is offered only toys shared with everyone.
      if (choice === GUEST) await clearActiveChild(database);
      else await setActiveChild(database, choice);
      await markChildModeUsed(database);
      router.replace('/child/home');
      await enterChildMode();
    } catch (caught: unknown) {
      setError(caught instanceof Error ? caught.message : 'Child Mode could not open.');
      setStarting(false);
    }
  };

  const chosenName = choice === GUEST ? 'Guest' : children.find((child) => child.id === choice)?.name;

  if (loading) {
    return (
      <PageShell scroll={false}>
        <SkeletonRows label="Loading child profiles…" rows={3} />
      </PageShell>
    );
  }

  return (
    <PageShell
      footer={
        <PrimaryButton
          busy={starting}
          disabled={choice === null}
          label={chosenName ? `Start playing as ${chosenName}` : 'Start playing'}
          onPress={() => {
            void start();
          }}
        />
      }
    >
      <BackNavigation label="Home" onPress={() => router.replace('/parent/home')} />
      <Text accessibilityRole="header" style={styles.title}>Who’s playing?</Text>

      {error ? <Banner message={error} tone="alert" /> : null}

      <View accessibilityRole="radiogroup" style={styles.grid}>
        {children.map((child) => (
          <ChoiceTile
            key={child.id}
            avatar={<ProfileAvatar accentColorId={child.accentColorId} avatarId={child.avatarId} decorative size={68} />}
            name={child.name}
            onPress={() => setChoice(child.id)}
            selected={choice === child.id}
          />
        ))}
        <ChoiceTile
          avatar={
            <View style={styles.guestAvatar}>
              <PipIcon color={theme.colors.brandInk} name="together" size={34} strokeWidth={1.6} />
            </View>
          }
          name="Guest"
          onPress={() => setChoice(GUEST)}
          selected={choice === GUEST}
        />
      </View>

      <View style={styles.note}>
        <Text style={styles.noteText}>
          <Text style={styles.noteStrong}>Guest play saves nothing.</Text>
          {' A visiting friend is offered only toys shared with everyone.'}
        </Text>
      </View>

      {children.length === 0 ? (
        <Text style={styles.help}>No profiles yet. Guest works right away, and you can add profiles in Settings.</Text>
      ) : null}
    </PageShell>
  );
}

function ChoiceTile({
  avatar,
  name,
  selected,
  onPress,
}: {
  avatar: React.ReactNode;
  name: string;
  selected: boolean;
  onPress(): void;
}) {
  return (
    <Pressable
      accessibilityLabel={name}
      accessibilityRole="radio"
      accessibilityState={{ checked: selected, selected }}
      onPress={onPress}
      style={({ pressed }) => [styles.tile, selected && styles.tileSelected, pressed && styles.pressed]}
    >
      {avatar}
      <Text numberOfLines={1} style={styles.tileName}>{name}</Text>
      {selected ? (
        <View style={styles.tileTick}>
          <PipIcon color={theme.colors.brandPrimaryLabel} name="check" size={13} strokeWidth={3} />
        </View>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pressed: { opacity: 0.72 },
  title: { color: theme.colors.primaryText, ...theme.typography.pageTitle, fontSize: 32, lineHeight: 37 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing[12] },
  tile: {
    alignItems: 'center',
    backgroundColor: theme.colors.cardSurface,
    borderColor: theme.colors.border,
    borderRadius: 20,
    borderWidth: 1,
    flexBasis: '46%',
    flexGrow: 1,
    gap: theme.spacing[8],
    paddingHorizontal: theme.spacing[12],
    paddingVertical: theme.spacing[16],
  },
  tileSelected: { backgroundColor: theme.colors.selectedSurface, borderColor: theme.colors.brandPrimary, borderWidth: 2 },
  tileName: { color: theme.colors.primaryText, ...theme.typography.sectionTitle },
  tileTick: {
    alignItems: 'center',
    backgroundColor: theme.colors.brandPrimary,
    borderRadius: theme.radii.pill,
    height: 24,
    justifyContent: 'center',
    position: 'absolute',
    right: 10,
    top: 10,
    width: 24,
  },
  guestAvatar: {
    alignItems: 'center',
    backgroundColor: theme.colors.brandPrimarySoft,
    borderRadius: theme.radii.pill,
    height: 68,
    justifyContent: 'center',
    width: 68,
  },
  note: {
    backgroundColor: theme.colors.cardSurface,
    borderColor: theme.colors.border,
    borderRadius: theme.radii.card,
    borderWidth: 1,
    padding: theme.spacing[16],
  },
  noteText: { color: theme.colors.secondaryText, ...theme.typography.meta, fontSize: 14, lineHeight: 20 },
  noteStrong: { color: theme.colors.primaryText, fontFamily: theme.fonts.bold },
  help: { color: theme.colors.secondaryText, ...theme.typography.meta },
});
