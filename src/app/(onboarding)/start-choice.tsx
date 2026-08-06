import { useState } from 'react';
import { router } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

import { pipBrand } from '@/brand/pip-brand';
import { NoticeBanner } from '@/components/auth-ui';
import { OnboardingScreen } from '@/components/onboarding-screen';
import { PastelNavigationCard } from '@/components/playmap-ui';
import { initializeDatabase } from '@/database/client';
import { seedSampleLibrary } from '@/features/samples/sample-library';
import { playmapTheme as theme } from '@/theme/playmap-theme';

/**
 * How the parent wants to begin, once setup is finished.
 *
 * Every option reaches a working destination, including "later": skipping
 * leads to Parent Home with empty states rather than a dead end. Nothing here
 * is required.
 */
export default function StartChoiceRoute() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const exploreSamples = async (): Promise<void> => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const database = await initializeDatabase();
      // Seeding is idempotent, so a double tap cannot produce two sample sets.
      await seedSampleLibrary(database);
      router.replace('/ready');
    } catch (caught: unknown) {
      setError(caught instanceof Error ? caught.message : 'Could not add the sample toys.');
      setBusy(false);
    }
  };

  return (
    <OnboardingScreen
      title="How would you like to start?"
      description={`You can change your mind at any time. ${pipBrand.name} is useful with one toy, and with a hundred.`}
    >
      {error ? <NoticeBanner message={error} tone="error" /> : null}

      <View style={styles.list}>
        <PastelNavigationCard
          title="Add our first toys"
          description="Photograph one toy and give it a home."
          tint={theme.colors.surfaceMint}
          onPress={() => router.replace({ pathname: '/parent/add-toy' })}
        />
        <PastelNavigationCard
          title="Upload photos in bulk"
          description="Add a batch of photos now and fill in details later."
          tint={theme.colors.surfaceSage}
          onPress={() => router.replace({ pathname: '/parent/add-toy', params: { mode: 'bulk' } })}
        />
        <PastelNavigationCard
          title="Explore with sample toys"
          description="Try Pip with a few made-up toys. You can clear them whenever you like."
          tint={theme.colors.surfaceYellow}
          onPress={() => {
            void exploreSamples();
          }}
        />
        <PastelNavigationCard
          title="I'll set it up later"
          description="Go straight to the parent home screen."
          tint={theme.colors.surfaceLavender}
          onPress={() => router.replace('/parent/home')}
        />
      </View>

      <Text style={styles.note}>
        Sample toys are clearly labelled and never mix with your own. Removing them leaves everything you added
        untouched.
      </Text>
    </OnboardingScreen>
  );
}

const styles = StyleSheet.create({
  list: { gap: theme.spacing[12] },
  note: { color: theme.colors.mutedText, ...theme.typography.supporting },
});
