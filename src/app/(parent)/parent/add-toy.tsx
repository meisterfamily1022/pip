import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { ToyForm } from '@/components/toy-form';
import { initializeDatabase } from '@/database/client';
import { BackLink, Body, ModeBadge, Screen, ScreenTitle } from '@/design/primitives';
import { spacing } from '@/design/tokens';
import { addToy, type ToyFormInput } from '@/features/toys/toy-service';

/**
 * Add Toy — the first half of the parent's job: photograph a toy and say where
 * it belongs. The form itself is shared with Edit Toy.
 */
export default function AddToyRoute() {
  const goBack = (): void => {
    if (router.canGoBack()) router.back();
    else router.replace('/parent/toy-library');
  };

  const save = async (input: ToyFormInput): Promise<void> => {
    const database = await initializeDatabase();
    await addToy(database, input);
    goBack();
  };

  return (
    <Screen mode="parent">
      <BackLink label="Toy Library" onPress={goBack} />
      <View style={styles.header}>
        <ModeBadge mode="parent" />
        <ScreenTitle>Add Toy</ScreenTitle>
        <Body>Take a photo, name it, and tell PlayMap where it lives.</Body>
      </View>
      <ToyForm onSubmit={save} submitLabel="Add Toy" />
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { gap: spacing.sm, marginBottom: spacing.xl, marginTop: spacing.md },
});
