import { useCallback, useState } from 'react';
import { router, useFocusEffect } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

import { pipBrand } from '@/brand/pip-brand';
import { OnboardingScreen } from '@/components/onboarding-screen';
import { PastelNavigationCard } from '@/components/playmap-ui';
import { initializeDatabase } from '@/database/client';
import { countSampleToys } from '@/features/samples/sample-library';
import { countToys } from '@/repositories/toys-repository';
import { playmapTheme as theme } from '@/theme/playmap-theme';

/**
 * Setup is done.
 *
 * Offers the three ways forward from the brief, and states plainly whether the
 * library currently holds real toys or samples, so a parent is never unsure
 * what they are looking at.
 */
export default function ReadyRoute() {
  const [total, setTotal] = useState(0);
  const [samples, setSamples] = useState(0);

  useFocusEffect(
    useCallback(() => {
      void (async () => {
        try {
          const database = await initializeDatabase();
          setTotal(await countToys(database));
          setSamples(await countSampleToys(database));
        } catch {
          // The counts are reassurance, not a gate. A failure here must not
          // block a parent from leaving this screen.
        }
      })();
    }, []),
  );

  const summary =
    samples > 0 && samples === total
      ? `Your library has ${samples} sample ${samples === 1 ? 'toy' : 'toys'} to try. Clear them from Settings whenever you like.`
      : total > 0
        ? `Your library has ${total} ${total === 1 ? 'toy' : 'toys'}. Keep adding now, or let your child explore whenever you are ready.`
        : `Add a toy whenever you are ready. ${pipBrand.name} works with one.`;

  return (
    <OnboardingScreen title={`Your ${pipBrand.name} is ready`} description={summary}>
      <View style={styles.list}>
        <PastelNavigationCard
          title="Go to the parent home"
          description="Manage toys, rooms, and settings."
          tint={theme.colors.surfaceMint}
          onPress={() => router.replace('/parent/home')}
        />
        <PastelNavigationCard
          title="Add another toy"
          description="Photograph the next one."
          tint={theme.colors.surfaceSage}
          onPress={() => router.replace({ pathname: '/parent/add-toy' })}
        />
        <PastelNavigationCard
          title="Preview Child Mode"
          description="See what your child sees."
          tint={theme.colors.surfaceYellow}
          onPress={() => router.replace('/parent/select-child')}
        />
      </View>

      <Text style={styles.note}>You can come back to any of these from the parent home screen.</Text>
    </OnboardingScreen>
  );
}

const styles = StyleSheet.create({
  list: { gap: theme.spacing[12] },
  note: { color: theme.colors.mutedText, ...theme.typography.supporting },
});
