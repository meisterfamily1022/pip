import { useCallback, useState } from 'react';
import { router, useFocusEffect } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

import { NoticeBanner } from '@/components/auth-ui';
import { ParentModeHeader } from '@/components/parent-ui';
import { ProfileAvatar } from '@/components/profile-ui';
import {
  ConfirmationDialog,
  EmptyStateCard,
  FormCard,
  LoadingState,
  PageShell,
  PrimaryButton,
} from '@/components/playmap-ui';
import { ToyButton } from '@/components/toy-ui';
import { initializeDatabase } from '@/database/client';
import { parentBackTargets } from '@/features/navigation/parent-navigation';
import { READING_SUPPORT_LABELS, isReadingSupport } from '@/domain/child-avatars';
import type { ChildProfile } from '@/domain/models';
import {
  deleteChildProfile,
  loadChildProfiles,
  reorderChildren,
  setChildHidden,
} from '@/features/children/child-profile-service';
import { playmapTheme as theme } from '@/theme/playmap-theme';

/**
 * Manages every child profile in the household.
 *
 * Profiles are optional: a household with none still works, and Child Mode
 * falls back to a single shared experience.
 */
export default function ChildrenRoute() {
  const [children, setChildren] = useState<ChildProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<ChildProfile | null>(null);

  const reload = useCallback(async (): Promise<void> => {
    try {
      const database = await initializeDatabase();
      setChildren(await loadChildProfiles(database, { includeHidden: true }));
      setError(null);
    } catch (caught: unknown) {
      setError(caught instanceof Error ? caught.message : 'Could not load child profiles.');
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void reload();
    }, [reload]),
  );

  // Every mutation is guarded by `busy`, so a double tap cannot queue two
  // conflicting writes.
  const run = async (action: () => Promise<unknown>): Promise<void> => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      await action();
      await reload();
    } catch (caught: unknown) {
      setError(caught instanceof Error ? caught.message : 'That did not work. Try again.');
    } finally {
      setBusy(false);
    }
  };

  const move = (child: ChildProfile, direction: -1 | 1): void => {
    const order = children.map((profile) => profile.id);
    const index = order.indexOf(child.id);
    const target = index + direction;
    if (index < 0 || target < 0 || target >= order.length) return;
    [order[index], order[target]] = [order[target], order[index]];
    void run(async () => {
      const database = await initializeDatabase();
      await reorderChildren(database, order);
    });
  };

  if (loading) return <PageShell scroll={false}><LoadingState label="Loading child profiles…" /></PageShell>;

  return (
    <PageShell>
      <ParentModeHeader
        backTo={parentBackTargets.children}
        subtitle="Each child gets their own choices and play history. Toys, rooms, and photos stay shared."
        title="Children"
      />

      {error ? <NoticeBanner message={error} tone="error" /> : null}

      {children.length === 0 ? (
        <EmptyStateCard
          message="No profiles yet. Pip works without them, and Child Mode will offer one shared experience."
          title="No child profiles"
        />
      ) : (
        <View style={styles.list}>
          {children.map((child, index) => (
            <FormCard key={child.id}>
              <View style={styles.row}>
                <ProfileAvatar accentColorId={child.accentColorId} avatarId={child.avatarId} name={child.name} size={52} />
                <View style={styles.details}>
                  <Text style={styles.name}>{child.name}</Text>
                  <Text style={styles.meta}>
                    {`${child.choiceLimit} choice${child.choiceLimit === 1 ? '' : 's'} · ${
                      isReadingSupport(child.readingSupport)
                        ? READING_SUPPORT_LABELS[child.readingSupport]
                        : READING_SUPPORT_LABELS['pictures-words']
                    }`}
                  </Text>
                  {/* Stated in words, never by colour alone. */}
                  {child.hiddenAt ? <Text style={styles.hidden}>Paused — not shown in Child Mode</Text> : null}
                </View>
              </View>

              <View style={styles.actions}>
                <ToyButton label="Edit" onPress={() => router.push({ pathname: '/parent/edit-child', params: { id: child.id } })} />
                <ToyButton
                  label={child.hiddenAt ? 'Unpause' : 'Pause'}
                  onPress={() =>
                    void run(async () => {
                      const database = await initializeDatabase();
                      await setChildHidden(database, child.id, !child.hiddenAt);
                    })
                  }
                />
                <ToyButton
                  accessibilityLabel={`Move ${child.name} up`}
                  disabled={index === 0}
                  label="Move up"
                  onPress={() => move(child, -1)}
                />
                <ToyButton
                  accessibilityLabel={`Move ${child.name} down`}
                  disabled={index === children.length - 1}
                  label="Move down"
                  onPress={() => move(child, 1)}
                />
                <ToyButton destructive label="Delete" onPress={() => setPendingDelete(child)} />
              </View>
            </FormCard>
          ))}
        </View>
      )}

      <PrimaryButton label="Add a child" onPress={() => router.push({ pathname: '/parent/edit-child' })} />

      <ConfirmationDialog
        confirmLabel="Delete profile"
        destructive
        message={
          pendingDelete
            ? `This removes ${pendingDelete.name}'s profile and their play history. Your toys, rooms, storage spots, and photos are not affected.`
            : ''
        }
        onCancel={() => setPendingDelete(null)}
        onConfirm={() => {
          const child = pendingDelete;
          setPendingDelete(null);
          if (child) {
            void run(async () => {
              const database = await initializeDatabase();
              await deleteChildProfile(database, child.id);
            });
          }
        }}
        title={pendingDelete ? `Delete ${pendingDelete.name}?` : ''}
        visible={pendingDelete !== null}
      />
    </PageShell>
  );
}

const styles = StyleSheet.create({
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing[8] },
  details: { flex: 1, gap: 2 },
  hidden: { color: theme.colors.warning, ...theme.typography.supporting },
  list: { gap: theme.spacing[12] },
  meta: { color: theme.colors.secondaryText, ...theme.typography.supporting },
  name: { color: theme.colors.primaryText, ...theme.typography.sectionTitle },
  row: { alignItems: 'center', flexDirection: 'row', gap: theme.spacing[16] },
});
