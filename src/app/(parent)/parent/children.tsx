import { useCallback, useState } from 'react';
import { router, useFocusEffect } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { ParentDetailScreen } from '@/components/parent-ui';
import { PipIcon } from '@/components/pip-icon';
import { ProfileAvatar } from '@/components/profile-ui';
import {
  Banner,
  ConfirmationDialog,
  EmptyStateCard,
  PrimaryButton,
  SecondaryButton,
  SkeletonRows,
} from '@/components/playmap-ui';
import { initializeDatabase } from '@/database/client';
import { parentBackTargets } from '@/features/navigation/parent-navigation';
import { READING_SUPPORT_LABELS, isReadingSupport } from '@/domain/child-avatars';
import type { ChildProfile } from '@/domain/models';
import { deleteChildProfile, loadChildProfiles, reorderChildren } from '@/features/children/child-profile-service';
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
  const [reordering, setReordering] = useState(false);

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

  if (loading) {
    return (
      <ParentDetailScreen backLabel="Settings" backTo={parentBackTargets.children}>
        <SkeletonRows label="Loading child profiles…" rows={3} />
      </ParentDetailScreen>
    );
  }

  return (
    <ParentDetailScreen
      backLabel="Settings"
      backTo={parentBackTargets.children}
      footer={<PrimaryButton label="Add a child" onPress={() => router.push({ pathname: '/parent/edit-child' })} />}
    >
      <View style={styles.header}>
        <View style={styles.headerCopy}>
          <Text accessibilityRole="header" style={styles.title}>Children</Text>
          <Text style={styles.subtitle}>
            Each child keeps their own choices and play history. Toys, rooms and photos stay shared.
          </Text>
        </View>
        {children.length > 1 ? (
          <Pressable
            accessibilityLabel={reordering ? 'Done reordering' : 'Reorder children'}
            accessibilityRole="button"
            hitSlop={10}
            onPress={() => setReordering((value) => !value)}
            style={({ pressed }) => [styles.reorderAction, pressed && styles.pressed]}
          >
            <Text style={styles.reorderLabel}>{reordering ? 'Done' : 'Reorder'}</Text>
          </Pressable>
        ) : null}
      </View>

      {error ? <Banner message={error} tone="alert" /> : null}

      {children.length === 0 ? (
        <EmptyStateCard
          icon="together"
          message="Pip works without them, and Child Mode offers one shared experience until you add one."
          title="No child profiles yet"
        />
      ) : (
        children.map((child, index) => (
          <View key={child.id} style={[styles.card, child.hiddenAt ? styles.cardPaused : null]}>
            <Pressable
              accessibilityHint="Opens this child’s profile"
              accessibilityLabel={`${child.name}. ${child.choiceLimit} ${child.choiceLimit === 1 ? 'choice' : 'choices'}. ${child.hiddenAt ? 'Paused, not offered in Child Mode' : ''}`}
              accessibilityRole="button"
              disabled={reordering}
              onPress={() => router.push({ pathname: '/parent/edit-child', params: { id: child.id } })}
              style={({ pressed }) => [styles.cardRow, pressed && styles.pressed]}
            >
              <ProfileAvatar accentColorId={child.accentColorId} avatarId={child.avatarId} decorative size={52} />
              <View style={styles.details}>
                <Text numberOfLines={2} style={styles.name}>{child.name}</Text>
                <Text numberOfLines={2} style={styles.meta}>
                  {`${child.choiceLimit} choice${child.choiceLimit === 1 ? '' : 's'} · ${
                    isReadingSupport(child.readingSupport)
                      ? READING_SUPPORT_LABELS[child.readingSupport]
                      : READING_SUPPORT_LABELS['pictures-words']
                  }`}
                </Text>
                {/* Stated in words, never by colour alone. */}
                {child.hiddenAt ? <Text style={styles.paused}>Paused — not offered in Child Mode</Text> : null}
              </View>
              {reordering ? null : <PipIcon color={theme.colors.mutedText} name="chevron-right" size={18} />}
            </Pressable>

            {reordering ? (
              <View style={styles.reorderRow}>
                <SecondaryButton
                  accessibilityLabel={`Move ${child.name} up`}
                  disabled={index === 0 || busy}
                  label="Move up"
                  onPress={() => move(child, -1)}
                  style={styles.reorderButton}
                />
                <SecondaryButton
                  accessibilityLabel={`Move ${child.name} down`}
                  disabled={index === children.length - 1 || busy}
                  label="Move down"
                  onPress={() => move(child, 1)}
                  style={styles.reorderButton}
                />
              </View>
            ) : null}
          </View>
        ))
      )}

      <Banner
        message="Guest play is always available without a profile. Nothing about a guest session is saved."
        tone="info"
      />

      <ConfirmationDialog
        cancelLabel="Keep the profile"
        confirmLabel="Delete profile"
        destructive
        message={
          pendingDelete
            ? `This removes ${pendingDelete.name}'s profile and their play history. Your toys, rooms, storage spots and photos are not affected. This cannot be undone.`
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
    </ParentDetailScreen>
  );
}

const styles = StyleSheet.create({
  pressed: { opacity: 0.72 },
  header: { alignItems: 'flex-start', flexDirection: 'row', gap: theme.spacing[12] },
  headerCopy: { flex: 1, gap: 2 },
  title: { color: theme.colors.primaryText, ...theme.typography.pageTitle },
  subtitle: { color: theme.colors.secondaryText, ...theme.typography.meta },
  reorderAction: { justifyContent: 'center', minHeight: theme.measurements.minimumTouchTarget },
  reorderLabel: { color: theme.colors.brandInk, ...theme.typography.label },
  card: {
    backgroundColor: theme.colors.cardSurface,
    borderColor: theme.colors.border,
    borderRadius: theme.radii.card,
    borderWidth: 1,
    overflow: 'hidden',
  },
  cardPaused: { backgroundColor: theme.colors.mutedSurface, borderColor: theme.colors.mutedBorder },
  cardRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: theme.spacing[12],
    minHeight: 68,
    padding: theme.spacing[12],
  },
  details: { flex: 1, gap: 2 },
  name: { color: theme.colors.primaryText, ...theme.typography.rowTitle },
  meta: { color: theme.colors.secondaryText, ...theme.typography.meta },
  paused: { color: theme.colors.error, ...theme.typography.meta },
  reorderRow: {
    borderTopColor: theme.colors.divider,
    borderTopWidth: 1,
    flexDirection: 'row',
    gap: theme.spacing[8],
    padding: theme.spacing[12],
  },
  reorderButton: { flex: 1, minHeight: theme.measurements.minimumTouchTarget },
});
