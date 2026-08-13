import { router, useLocalSearchParams } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

import { PipIcon } from '@/components/pip-icon';
import { PageShell, PrimaryButton, QuietButton, SecondaryButton } from '@/components/playmap-ui';
import { playmapTheme as theme } from '@/theme/playmap-theme';

/** The deliberate handoff between household setup and Pip's real value. */
export default function FirstToyRoute() {
  const { added } = useLocalSearchParams<{ added?: string }>();
  const hasFirstToy = added === '1';

  return (
    <PageShell
      footer={hasFirstToy ? (
        <>
          <PrimaryButton label="Try Child Mode" onPress={() => router.replace('/parent/select-child')} />
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
    </PageShell>
  );
}

const styles = StyleSheet.create({
  hero: { alignItems: 'center', gap: theme.spacing[12], paddingTop: theme.spacing[40] },
  icon: { alignItems: 'center', backgroundColor: theme.colors.brandPrimarySoft, borderRadius: theme.radii.pill, height: 64, justifyContent: 'center', width: 64 },
  title: { color: theme.colors.primaryText, textAlign: 'center', ...theme.typography.pageTitle },
  body: { color: theme.colors.secondaryText, maxWidth: 420, textAlign: 'center', ...theme.typography.body },
});
