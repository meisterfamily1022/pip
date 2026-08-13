import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { PipIcon } from '@/components/pip-icon';
import { Banner, PageShell, PrimaryButton, QuietButton, SecondaryButton } from '@/components/playmap-ui';
import { initializeDatabase } from '@/database/client';
import type { ChildProfile } from '@/domain/models';
import { listChildProfiles } from '@/repositories/child-profiles-repository';
import { setActiveChild } from '@/repositories/settings-repository';
import { enterChildMode } from '@/startup/route-access';
import { playmapTheme as theme } from '@/theme/playmap-theme';

/** The deliberate handoff between household setup and Pip's real value. */
export default function FirstToyRoute() {
  const { added } = useLocalSearchParams<{ added?: string }>();
  const hasFirstToy = added === '1';
  const [children, setChildren] = useState<ChildProfile[]>([]);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void initializeDatabase().then(listChildProfiles).then(setChildren).catch(() => undefined);
  }, []);

  const tryChildMode = async (): Promise<void> => {
    if (starting) return;
    if (children.length !== 1) {
      router.replace('/parent/select-child');
      return;
    }
    setStarting(true);
    setError(null);
    try {
      const database = await initializeDatabase();
      await setActiveChild(database, children[0].id);
      await enterChildMode();
      router.replace('/child/home');
    } catch (caught: unknown) {
      setError(caught instanceof Error ? caught.message : 'Child Mode could not open.');
      setStarting(false);
    }
  };

  return (
    <PageShell
      footer={hasFirstToy ? (
        <>
          <PrimaryButton busy={starting} label={starting ? 'Opening Child Mode…' : 'Try Child Mode'} onPress={() => void tryChildMode()} />
          <QuietButton label="Go to Parent Home" onPress={() => router.replace('/parent/home')} />
        </>
      ) : (
        <>
          <PrimaryButton label="Photograph a shelf" onPress={() => router.replace('/parent/add-toy?mode=bulk&first=1')} />
          <SecondaryButton label="Add one toy by hand" onPress={() => router.replace('/parent/add-toy?mode=manual&first=1')} />
          <QuietButton label="I’ll do this later" onPress={() => router.replace('/parent/home')} />
        </>
      )}
    >
      <View style={styles.hero}>
        <View style={styles.icon}><PipIcon color={theme.colors.brandInk} name={hasFirstToy ? 'check' : 'camera'} size={30} /></View>
        <Text accessibilityRole="header" style={styles.title}>{hasFirstToy ? 'Your first toy is ready' : 'Add your first toy'}</Text>
        <Text style={styles.body}>
          {hasFirstToy
            ? 'See exactly what your child will see, using the toy you just added.'
            : 'Start with a shelf for the quickest setup, add one toy by hand, or come back when it suits you.'}
        </Text>
      </View>
      {error ? <Banner message={error} tone="alert" /> : null}
    </PageShell>
  );
}

const styles = StyleSheet.create({
  hero: { alignItems: 'center', gap: theme.spacing[12], paddingTop: theme.spacing[40] },
  icon: { alignItems: 'center', backgroundColor: theme.colors.brandPrimarySoft, borderRadius: theme.radii.pill, height: 64, justifyContent: 'center', width: 64 },
  title: { color: theme.colors.primaryText, textAlign: 'center', ...theme.typography.pageTitle },
  body: { color: theme.colors.secondaryText, maxWidth: 420, textAlign: 'center', ...theme.typography.body },
});
