import { useCallback, useState } from 'react';
import { router, useFocusEffect } from 'expo-router';
import { Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';

import { ChildPage } from '@/components/child-ui';
import { PipIcon } from '@/components/pip-icon';
import { ProfileAvatar } from '@/components/profile-ui';
import { Banner, SkeletonRows } from '@/components/playmap-ui';
import { ToyPhoto, ToyPhotoCollage, toysWithPhotos } from '@/components/toy-photo';
import { initializeDatabase } from '@/database/client';
import type { ChildProfile } from '@/domain/models';
import { displayChildName, displayToyName } from '@/domain/presentation';
import { getActiveChildProfile } from '@/repositories/child-profiles-repository';
import { getActivePlaySession, type ActivePlaySession } from '@/repositories/play-sessions-repository';
import { getSettings } from '@/repositories/settings-repository';
import { listChildToys, type ChildToy } from '@/repositories/toys-repository';
import { playmapTheme as theme } from '@/theme/playmap-theme';

/**
 * Child Home.
 *
 * The child chooses from pictures of their own toys, not from icons. Every
 * image on this screen is a photograph the family actually saved: the collage
 * on "Pick a toy" is drawn from what is genuinely available right now, and
 * "Playing now" shows the toy that is really out. Nothing here is illustrated,
 * generated, or stood in for — a child recognising their own marble run is the
 * entire point, and a generic picture would break that.
 *
 * The only way to Parent Mode is the PIN, pinned quietly at the bottom.
 */
export default function ChildHomeRoute() {
  const { fontScale } = useWindowDimensions();
  const [child, setChild] = useState<ChildProfile | null>(null);
  const [session, setSession] = useState<ActivePlaySession | null>(null);
  const [toys, setToys] = useState<ChildToy[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const database = await initializeDatabase();
      const profile = await getActiveChildProfile(database);
      const settings = await getSettings(database);
      const [active, available] = await Promise.all([
        getActivePlaySession(database, profile.id),
        listChildToys(database, { childId: settings.activeChildId }),
      ]);
      setChild(profile);
      setSession(active);
      setToys(available);
      setError(null);
    } catch (caught: unknown) {
      setError(caught instanceof Error ? caught.message : 'Pip could not get ready.');
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => {
    void load();
  }, [load]));

  const parentModeFooter = (
    <View style={styles.grownUpsRow}>
      <Pressable
        accessibilityHint="Opens the parent PIN screen"
        accessibilityLabel="Parent mode"
        accessibilityRole="button"
        onPress={() => router.push('/child/parent-return')}
        style={({ pressed }) => [styles.grownUps, pressed && styles.pressed]}
      >
        <PipIcon color={theme.colors.mutedText} name="lock" size={16} />
        <Text maxFontSizeMultiplier={1.15} style={styles.grownUpsText}>Parent mode</Text>
      </Pressable>
    </View>
  );

  if (loading) {
    return (
      <ChildPage footer={parentModeFooter} footerPlain>
        <SkeletonRows label="Getting Pip ready…" rows={3} />
      </ChildPage>
    );
  }

  const name = child ? displayChildName(child.name) : null;
  const photographed = toysWithPhotos(toys);
  const hasToys = toys.length > 0;

  return (
    <ChildPage footer={parentModeFooter} footerPlain>
      {error ? <Banner message={error} tone="alert" /> : null}

      <View style={styles.greeting}>
        {child && fontScale < 2 ? (
          <ProfileAvatar accentColorId={child.accentColorId} avatarId={child.avatarId} decorative size={56} />
        ) : null}
        <View style={styles.greetingCopy}>
          <Text maxFontSizeMultiplier={1.3} style={styles.hello}>{name ? `Hi, ${name}!` : 'Hi!'}</Text>
          <Text accessibilityRole="header" maxFontSizeMultiplier={1.1} style={styles.title}>What do you want to play with?</Text>
        </View>
      </View>

      {session?.toy ? (
        <PlayingNowCard
          name={displayToyName(session.toy.name)}
          onPress={() => router.push('/child/current-toy')}
          uri={session.toy.imageUri}
        />
      ) : null}

      {hasToys ? (
        <>
          <PickAToyCard
            onPress={() => router.push('/child/categories')}
            photographed={photographed}
            total={toys.length}
          />
          <SurpriseMeCard
            onPress={() => router.push({ pathname: '/child/toy-suggestions', params: { category: 'anything', surprise: '1' } })}
            photographed={photographed}
          />
        </>
      ) : (
        <NoToysYet />
      )}
    </ChildPage>
  );
}

/**
 * The primary choice, and the largest thing on the screen.
 *
 * When photographs exist the child sees their own shelf. When the library is
 * real but nothing has been photographed yet, the card stays text-led rather
 * than filling the space with a stand-in picture.
 */
function PickAToyCard({
  photographed,
  total,
  onPress,
}: {
  photographed: readonly ChildToy[];
  total: number;
  onPress(): void;
}) {
  const collage = photographed.slice(0, 4);
  const label = `Pick a toy. Choose from ${total} ${total === 1 ? 'toy' : 'toys'}`;
  return (
    <Pressable
      accessibilityHint="Shows kinds of play to choose from"
      accessibilityLabel={label}
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.hero, pressed && styles.pressed]}
    >
      {collage.length > 0 ? (
        <ToyPhotoCollage
          accessibilityLabel={`${collage.length} of your toys`}
          style={styles.heroCollage}
          toys={collage.map((toy) => ({ id: toy.id, name: displayToyName(toy.name), imageUri: toy.imageUri }))}
        />
      ) : null}
      <View style={styles.heroCaption}>
        <View style={styles.heroCopy}>
          <Text maxFontSizeMultiplier={1.15} style={styles.heroTitle}>Pick a toy</Text>
          <Text maxFontSizeMultiplier={1.2} numberOfLines={2} style={styles.heroDetail}>
            {collage.length > 0
              ? 'Choose what looks fun'
              : `${total} ${total === 1 ? 'toy is' : 'toys are'} ready to choose from`}
          </Text>
        </View>
        <PipIcon color={theme.colors.brandInk} name="chevron-right" size={22} />
      </View>
    </Pressable>
  );
}

/**
 * Let Pip choose.
 *
 * Shown as a short fan of real, currently-available toys: truthful about what
 * could come up without committing to one and spoiling it. With no photographs
 * it degrades to a plain worded card rather than a gift icon.
 */
function SurpriseMeCard({ photographed, onPress }: { photographed: readonly ChildToy[]; onPress(): void }) {
  const fan = photographed.slice(0, 3);
  return (
    <Pressable
      accessibilityHint="Pip picks one toy for you"
      accessibilityLabel="Surprise me. Let Pip pick one"
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.surprise, pressed && styles.pressed]}
    >
      {fan.length > 0 ? (
        <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={styles.fan}>
          {fan.map((toy, index) => (
            <ToyPhoto
              decorative
              key={toy.id}
              name={displayToyName(toy.name)}
              style={[styles.fanPhoto, index > 0 && styles.fanPhotoOverlap]}
              tier="small"
              uri={toy.imageUri}
            />
          ))}
        </View>
      ) : null}
      <View style={styles.surpriseCopy}>
        <Text maxFontSizeMultiplier={1.15} style={styles.surpriseTitle}>Surprise me</Text>
        <Text maxFontSizeMultiplier={1.2} numberOfLines={2} style={styles.surpriseDetail}>Let Pip pick one</Text>
      </View>
      <PipIcon color={theme.colors.brandInk} name="chevron-right" size={20} />
    </Pressable>
  );
}

/** The toy that is really out, shown large enough to recognise across a room. */
function PlayingNowCard({ name, uri, onPress }: { name: string; uri: string | null; onPress(): void }) {
  return (
    <Pressable
      accessibilityHint="Shows where it goes when you are finished"
      accessibilityLabel={`Playing now, ${name}`}
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.playing, pressed && styles.pressed]}
    >
      <ToyPhoto decorative name={name} style={styles.playingPhoto} tier="small" uri={uri} />
      <View style={styles.playingCopy}>
        <Text maxFontSizeMultiplier={1.2} style={styles.playingLabel}>Playing now</Text>
        <Text maxFontSizeMultiplier={1.15} numberOfLines={2} style={styles.playingName}>{name}</Text>
      </View>
      <PipIcon color={theme.colors.brandInk} name="chevron-right" size={20} />
    </Pressable>
  );
}

/** No toys at all. Honest, calm, and pointed at the grown-up who can fix it. */
function NoToysYet() {
  return (
    <View style={styles.empty}>
      <Text accessibilityRole="header" maxFontSizeMultiplier={1.5} style={styles.emptyTitle}>No toys yet</Text>
      <Text maxFontSizeMultiplier={1.8} style={styles.emptyBody}>
        A grown-up adds toys by taking a photo of each one. Once they have, your toys show up right here.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pressed: { opacity: 0.78 },

  greeting: { alignItems: 'center', flexDirection: 'row', gap: theme.spacing[12], paddingVertical: theme.spacing[8] },
  greetingCopy: { flex: 1, gap: 2 },
  hello: { color: theme.colors.secondaryText, ...theme.typography.rowTitle },
  title: { color: theme.colors.primaryText, ...theme.typography.childTitle, fontSize: 30, lineHeight: 34 },

  // Primary choice: photographs first, one clean caption bar beneath them so
  // the label never fights the imagery for contrast.
  hero: {
    backgroundColor: theme.colors.cardSurface,
    borderColor: theme.colors.border,
    borderRadius: theme.radii.sheet,
    borderWidth: 1,
    overflow: 'hidden',
  },
  heroCollage: { borderBottomLeftRadius: 0, borderBottomRightRadius: 0 },
  heroCaption: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: theme.spacing[12],
    minHeight: 72,
    paddingHorizontal: theme.spacing[16],
    paddingVertical: theme.spacing[16],
  },
  heroCopy: { flex: 1, gap: 2 },
  heroTitle: { color: theme.colors.primaryText, ...theme.typography.childTitle, fontSize: 26, lineHeight: 30 },
  heroDetail: { color: theme.colors.secondaryText, ...theme.typography.body },

  surprise: {
    alignItems: 'center',
    backgroundColor: theme.colors.surfaceSunshine,
    borderColor: theme.colors.borderSunshine,
    borderRadius: theme.radii.sheet,
    borderWidth: 1,
    flexDirection: 'row',
    gap: theme.spacing[16],
    minHeight: 92,
    padding: theme.spacing[16],
  },
  fan: { flexDirection: 'row' },
  fanPhoto: {
    aspectRatio: 1,
    borderColor: theme.colors.background,
    borderRadius: theme.radii.control,
    borderWidth: 2,
    height: 56,
    minHeight: 0,
    width: 56,
  },
  fanPhotoOverlap: { marginLeft: -22 },
  surpriseCopy: { flex: 1, gap: 2 },
  surpriseTitle: { color: theme.colors.primaryText, ...theme.typography.sectionTitle, fontSize: 22 },
  surpriseDetail: { color: theme.colors.secondaryText, ...theme.typography.body },

  playing: {
    alignItems: 'center',
    backgroundColor: theme.colors.selectedSurface,
    borderColor: theme.colors.infoBorder,
    borderRadius: theme.radii.sheet,
    borderWidth: 1,
    flexDirection: 'row',
    gap: theme.spacing[16],
    minHeight: 92,
    padding: theme.spacing[12],
  },
  playingPhoto: { borderRadius: theme.radii.card, height: 72, minHeight: 0, width: 72 },
  playingCopy: { flex: 1, gap: 2 },
  playingLabel: { color: theme.colors.brandInk, ...theme.typography.eyebrow },
  playingName: { color: theme.colors.primaryText, ...theme.typography.sectionTitle, fontSize: 22 },

  empty: {
    backgroundColor: theme.colors.cardSurface,
    borderColor: theme.colors.border,
    borderRadius: theme.radii.sheet,
    borderWidth: 1,
    gap: 6,
    padding: theme.spacing[20],
  },
  emptyTitle: { color: theme.colors.primaryText, ...theme.typography.sectionTitle, fontSize: 22 },
  emptyBody: { color: theme.colors.secondaryText, ...theme.typography.body },

  grownUpsRow: { alignItems: 'flex-end' },
  grownUps: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 6,
    minHeight: theme.measurements.minimumTouchTarget,
    paddingHorizontal: theme.spacing[8],
  },
  grownUpsText: { color: theme.colors.mutedText, ...theme.typography.label, fontSize: 14 },
});
