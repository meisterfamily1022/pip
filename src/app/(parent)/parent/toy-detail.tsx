import { useCallback, useState } from 'react';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { PipIcon } from '@/components/pip-icon';
import {
  Banner,
  ConfirmationDialog,
  ErrorStateCard,
  ListCard,
  ListRow,
  PageShell,
  PrimaryButton,
  SecondaryButton,
  Sheet,
  SkeletonRows,
  ToyImage,
} from '@/components/playmap-ui';
import { initializeDatabase } from '@/database/client';
import { PLAY_CATEGORIES, type PlayCategory } from '@/domain/play-category';
import { cleanupDifficultyLabel } from '@/features/toys/toy-filter-state';
import {
  archiveParentToy,
  getToyDeletionImpact,
  permanentlyDeleteParentToy,
  restoreParentToy,
  setParentToyAvailability,
} from '@/features/toys/toy-service';
import { listActivePlaySessions } from '@/repositories/play-sessions-repository';
import { getParentToy, type ParentToy } from '@/repositories/toys-repository';
import { playmapTheme as theme } from '@/theme/playmap-theme';

const categoryLabels: Record<PlayCategory, string> = {
  quiet: 'Quiet', active: 'Active', creative: 'Make', building: 'Build', pretend: 'Pretend',
  sensory: 'Touch & feel', independent: 'Alone', together: 'Together', indoor: 'Indoor', outdoor: 'Outdoor',
};

/**
 * A single toy.
 *
 * Editing is the primary action. Hiding, archiving and deleting live behind the
 * ⋯ menu, so a destructive control never sits next to the one a parent reaches
 * for most — and each of them states its consequence before it runs.
 */
export default function ToyDetailRoute() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const toyId = Number(id);
  const [toy, setToy] = useState<ParentToy | null>(null);
  const [holder, setHolder] = useState<{ name: string; since: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!Number.isInteger(toyId) || toyId < 1) {
      setError('That toy link is not valid.');
      setLoading(false);
      return;
    }
    setError(null);
    try {
      const database = await initializeDatabase();
      const [record, sessions] = await Promise.all([getParentToy(database, toyId), listActivePlaySessions(database)]);
      if (!record) throw new Error('This toy is no longer in the library.');
      setToy(record);
      const session = sessions.find((candidate) => candidate.toyId === toyId);
      setHolder(session ? { name: session.childName, since: session.startedAt } : null);
    } catch (caught: unknown) {
      setError(caught instanceof Error ? caught.message : 'This toy could not load.');
    } finally {
      setLoading(false);
    }
  }, [toyId]);

  useFocusEffect(useCallback(() => {
    void load();
  }, [load]));

  const run = async (task: (database: Awaited<ReturnType<typeof initializeDatabase>>) => Promise<void>): Promise<void> => {
    setBusy(true);
    setMenuOpen(false);
    try {
      const database = await initializeDatabase();
      await task(database);
      await load();
    } catch (caught: unknown) {
      setError(caught instanceof Error ? caught.message : 'That change could not be saved.');
    } finally {
      setBusy(false);
    }
  };

  const askToDelete = async (): Promise<void> => {
    setMenuOpen(false);
    try {
      const database = await initializeDatabase();
      const impact = await getToyDeletionImpact(database, toyId);
      setPendingDelete(impact.message);
    } catch (caught: unknown) {
      setError(caught instanceof Error ? caught.message : 'That deletion could not be prepared.');
    }
  };

  const confirmDelete = async (): Promise<void> => {
    setBusy(true);
    try {
      const database = await initializeDatabase();
      await permanentlyDeleteParentToy(database, toyId);
      setPendingDelete(null);
      router.replace('/parent/toy-library');
    } catch (caught: unknown) {
      setError(caught instanceof Error ? caught.message : 'That toy could not be deleted.');
      setPendingDelete(null);
      setBusy(false);
    }
  };

  if (loading) {
    return (
      <PageShell scroll={false}>
        <SkeletonRows label="Loading this toy…" rows={3} />
      </PageShell>
    );
  }

  if (!toy) {
    return (
      <PageShell>
        <ErrorStateCard
          action={<PrimaryButton label="Back to the library" onPress={() => router.replace('/parent/toy-library')} />}
          message={error ?? 'This toy is no longer in the library.'}
          title="Toy not found"
        />
      </PageShell>
    );
  }

  const since = holder ? new Date(holder.since).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' }) : null;

  return (
    <PageShell
      footer={<PrimaryButton label="Edit toy" onPress={() => router.push(`/parent/edit-toy?id=${toy.id}`)} />}
    >
      <View style={styles.hero}>
        {toy.imageUri ? (
          <ToyImage accessibilityLabel={`${toy.name} photo`} style={styles.heroPhoto} uri={toy.imageUri} />
        ) : (
          <Pressable
            accessibilityHint="Opens Edit Toy so you can take or choose a photo"
            accessibilityLabel={`Add a photo for ${toy.name}`}
            accessibilityRole="button"
            onPress={() => router.push(`/parent/edit-toy?id=${toy.id}`)}
            style={({ pressed }) => [styles.missingPhoto, pressed && styles.pressed]}
          >
            <PipIcon color={theme.colors.brandInk} name="photo-missing" size={22} />
            <Text style={styles.missingPhotoLabel}>Add a toy photo</Text>
          </Pressable>
        )}
        <View style={styles.heroBar}>
          <Pressable
            accessibilityLabel="Back to the library"
            accessibilityRole="button"
            onPress={() => router.replace('/parent/toy-library')}
            style={({ pressed }) => [styles.heroButton, styles.heroBack, pressed && styles.pressed]}
          >
            <PipIcon color={theme.colors.brandInk} name="chevron-left" size={18} />
            <Text style={styles.heroBackLabel}>Library</Text>
          </Pressable>
          <Pressable
            accessibilityHint="Hide, archive or delete this toy"
            accessibilityLabel="More actions"
            accessibilityRole="button"
            onPress={() => setMenuOpen(true)}
            style={({ pressed }) => [styles.heroButton, styles.heroMore, pressed && styles.pressed]}
          >
            <PipIcon color={theme.colors.brandInk} name="more" size={18} />
          </Pressable>
        </View>
      </View>

      <View style={styles.titleBlock}>
        <Text accessibilityRole="header" style={styles.title}>{toy.name}</Text>
        {toy.categories.length > 0 || toy.cleanupDifficulty ? (
          <Text style={styles.subtitle}>
            {[
              ...toy.categories.filter((category): category is PlayCategory => PLAY_CATEGORIES.includes(category)).map((category) => categoryLabels[category]),
              cleanupDifficultyLabel(toy.cleanupDifficulty),
            ].join(' · ')}
          </Text>
        ) : null}
      </View>

      {error ? <Banner message={error} tone="alert" /> : null}

      {holder ? (
        <Banner message={`${holder.name} has this out${since ? ` — since ${since}` : ''}.`} tone="alert" />
      ) : null}

      {toy.isArchived ? (
        <Banner message="This toy is archived. It stays in your records but is never offered in Child Mode." tone="info" />
      ) : null}

      <ListCard>
        <ListRow title="Room" value={toy.roomName} />
        <ListRow title="Storage spot" value={toy.storageSpotName} />
        <ListRow title="Shown in Child Mode" value={toy.isAvailable && !toy.isArchived ? 'Yes' : 'No'} />
        <ListRow title="Grown-up help" value={toy.adultHelpRequired ? 'Needed' : 'Not needed'} />
      </ListCard>

      <Sheet onDismiss={() => setMenuOpen(false)} title={toy.name} visible={menuOpen}>
        <ListCard>
          <ListRow
            accessory="none"
            detail={toy.isAvailable ? 'Keeps the record, stops offering it' : 'Offer it in Child Mode again'}
            icon={toy.isAvailable ? 'lock' : 'check'}
            onPress={() => {
              void run((database) => setParentToyAvailability(database, toy.id, !toy.isAvailable));
            }}
            title={toy.isAvailable ? 'Hide from Child Mode' : 'Show in Child Mode'}
          />
          <ListRow
            accessory="none"
            detail={toy.isArchived ? 'Return it to the active library' : 'Keeps it out of the library and Child Mode'}
            icon="library"
            onPress={() => {
              void run((database) => (toy.isArchived ? restoreParentToy(database, toy.id) : archiveParentToy(database, toy.id)));
            }}
            title={toy.isArchived ? 'Restore toy' : 'Archive toy'}
          />
          <ListRow
            accessory="none"
            detail="Removes the toy and its play history"
            icon="trash"
            onPress={() => {
              void askToDelete();
            }}
            title="Delete toy"
            tone="danger"
          />
        </ListCard>
        <SecondaryButton label="Cancel" onPress={() => setMenuOpen(false)} />
      </Sheet>

      <ConfirmationDialog
        busy={busy}
        cancelLabel="Keep"
        confirmLabel="Delete this toy"
        destructive
        message={pendingDelete ?? ''}
        onCancel={() => setPendingDelete(null)}
        onConfirm={() => {
          void confirmDelete();
        }}
        title={`Delete “${toy.name}”?`}
        visible={pendingDelete !== null}
      >
        <View style={styles.alternative}>
          <Text style={styles.alternativeText}>
            Want to keep it but stop offering it? Hiding it from Child Mode leaves the record intact.
          </Text>
        </View>
      </ConfirmationDialog>
    </PageShell>
  );
}

const styles = StyleSheet.create({
  pressed: { opacity: 0.72 },
  hero: { borderRadius: theme.radii.card, marginHorizontal: -theme.spacing[4], overflow: 'hidden' },
  heroPhoto: { aspectRatio: 16 / 11, width: '100%' },
  missingPhoto: {
    alignItems: 'center',
    backgroundColor: theme.colors.photoFallback,
    gap: theme.spacing[8],
    height: 156,
    justifyContent: 'flex-end',
    paddingBottom: theme.spacing[16],
    width: '100%',
  },
  missingPhotoLabel: { color: theme.colors.brandInk, ...theme.typography.label, fontSize: 14 },
  heroBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    left: theme.spacing[8],
    position: 'absolute',
    right: theme.spacing[8],
    top: theme.spacing[8],
  },
  heroButton: {
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.92)',
    borderRadius: theme.radii.pill,
    flexDirection: 'row',
    justifyContent: 'center',
    minHeight: theme.measurements.minimumTouchTarget,
  },
  heroBack: { gap: 2, paddingHorizontal: theme.spacing[12] },
  heroBackLabel: { color: theme.colors.brandInk, ...theme.typography.label, fontSize: 14 },
  heroMore: { width: theme.measurements.minimumTouchTarget },
  titleBlock: { gap: 2 },
  title: { color: theme.colors.primaryText, ...theme.typography.pageTitle, fontSize: 26, lineHeight: 31 },
  subtitle: { color: theme.colors.secondaryText, ...theme.typography.meta },
  alternative: {
    backgroundColor: theme.colors.warmSurface,
    borderColor: theme.colors.warmBorder,
    borderRadius: theme.radii.control,
    borderWidth: 1,
    marginTop: theme.spacing[8],
    padding: theme.spacing[12],
  },
  alternativeText: { color: theme.colors.secondaryText, ...theme.typography.meta },
});
