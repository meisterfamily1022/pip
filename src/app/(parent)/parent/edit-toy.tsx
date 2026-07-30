import { useEffect, useState } from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { ToyForm } from '@/components/toy-form';
import { initializeDatabase } from '@/database/client';
import { ToyBoxEmptyIcon, TrashIcon } from '@/design/icons';
import {
  BackLink,
  Body,
  DangerButton,
  EmptyState,
  ErrorState,
  LoadingState,
  ModeBadge,
  Screen,
  ScreenTitle,
  SecondaryButton,
} from '@/design/primitives';
import { spacing } from '@/design/tokens';
import { confirmLocationDeletion } from '@/features/locations/confirmation';
import { loadToy, removeToy, saveToy, type ToyFormInput, type ToyWithLocation } from '@/features/toys/toy-service';

/**
 * Edit Toy — the same form as Add Toy, prefilled from `?id=`, plus the delete
 * action for a toy that has left the house.
 */
export default function EditToyRoute() {
  const params = useLocalSearchParams<{ id?: string | string[] }>();
  const rawId = Array.isArray(params.id) ? params.id[0] : params.id;
  const toyId = /^\d+$/.test(rawId ?? '') ? Number(rawId) : null;

  const [toy, setToy] = useState<ToyWithLocation | null>(null);
  /** A malformed `?id=` never loads anything, so it skips straight to the not-found state. */
  const [loading, setLoading] = useState(toyId !== null);
  const [error, setError] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);

  useEffect(() => {
    if (toyId === null) return;
    let active = true;
    void (async () => {
      try {
        const database = await initializeDatabase();
        const loaded = await loadToy(database, toyId);
        if (!active) return;
        setToy(loaded);
        setError(null);
      } catch (caught: unknown) {
        if (!active) return;
        setError(caught instanceof Error ? caught.message : 'Could not load this toy.');
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [reloadToken, toyId]);

  const goBack = (): void => {
    if (router.canGoBack()) router.back();
    else router.replace('/parent/toy-library');
  };

  const save = async (input: ToyFormInput): Promise<void> => {
    if (toyId === null) return;
    const database = await initializeDatabase();
    await saveToy(database, toyId, input);
    goBack();
  };

  const remove = (): void => {
    if (!toy) return;
    void (async () => {
      const confirmed = await confirmLocationDeletion(
        'Delete toy?',
        `Delete ${toy.name}? This also removes its photo and play history.`,
      );
      if (!confirmed) return;
      try {
        const database = await initializeDatabase();
        await removeToy(database, toy.id);
        goBack();
      } catch (caught: unknown) {
        setError(caught instanceof Error ? caught.message : `Could not delete ${toy.name}.`);
      }
    })();
  };

  return (
    <Screen mode="parent">
      <BackLink label="Toy Library" onPress={goBack} />
      <View style={styles.header}>
        <ModeBadge mode="parent" />
        <ScreenTitle>Edit Toy</ScreenTitle>
        <Body>{toy ? `Update ${toy.name}, or move it to a new home.` : 'Update a toy in your library.'}</Body>
      </View>

      {loading ? (
        <View style={styles.stateBlock}>
          <LoadingState label="Loading this toy…" />
        </View>
      ) : error && !toy ? (
        <View style={styles.stateBlock}>
          <ErrorState message={error} onRetry={() => setReloadToken((token) => token + 1)} />
        </View>
      ) : !toy ? (
        <EmptyState
          action={<SecondaryButton label="Back to Toy Library" onPress={goBack} />}
          description="This toy may already have been deleted. Head back to the library to pick another one."
          icon={ToyBoxEmptyIcon}
          title="Toy not found"
        />
      ) : (
        <ToyForm
          footer={
            <DangerButton
              accessibilityLabel={`Delete ${toy.name}`}
              icon={TrashIcon}
              label="Delete Toy"
              onPress={remove}
              style={styles.delete}
            />
          }
          initialValue={{
            name: toy.name,
            imageUri: toy.imageUri,
            roomId: toy.roomId,
            storageSpotId: toy.storageSpotId,
            categories: toy.categories,
            isAvailable: toy.isAvailable,
          }}
          onSubmit={save}
          submitLabel="Save Toy"
        />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  delete: { alignSelf: 'flex-start' },
  header: { gap: spacing.sm, marginBottom: spacing.xl, marginTop: spacing.md },
  stateBlock: { minHeight: 200 },
});
