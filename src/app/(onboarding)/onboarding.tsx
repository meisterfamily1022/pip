import { router } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

import { pipBrand } from '@/brand/pip-brand';
import { PrimaryButton } from '@/components/onboarding-controls';
import { PipBrandMark } from '@/components/pip-brand-mark';
import { PipIcon, type PipIconName } from '@/components/pip-icon';
import { PageShell, QuietButton } from '@/components/playmap-ui';
import { playmapTheme as theme } from '@/theme/playmap-theme';
import { onboardingProgressStorage } from '@/services/onboarding-progress-storage';

/**
 * Welcome.
 *
 * One screen, three sentences about what Pip actually does, and one way on.
 * The logo is deliberately small: it introduces the product, it is not the
 * product. Nothing here asks for anything.
 */
const promises: { icon: PipIconName; copy: string }[] = [
  { icon: 'camera', copy: 'Take a photo of each toy. Work through a whole shelf in one go.' },
  { icon: 'spaces', copy: 'Say where each toy belongs — a room, and a spot inside it.' },
  { icon: 'together', copy: 'Hand the phone to your child. They see a few toys, not the whole room.' },
];

export default function OnboardingHomeRoute() {
  return (
    <PageShell
      footer={
        <>
          <PrimaryButton label={`Set up ${pipBrand.name}`} onPress={() => void onboardingProgressStorage.markStarted().then(() => router.replace('/parent-pin-setup'))} />
          <Text style={styles.footnote}>Takes about two minutes. Nothing leaves this device.</Text>
        </>
      }
    >
      <View style={styles.hero}>
        <PipBrandMark variant="wordmark" width={132} />
        <Text style={styles.tagline}>{pipBrand.primaryTagline}</Text>
      </View>

      <View style={styles.promises}>
        {promises.map(({ icon, copy }) => (
          <View key={icon} style={styles.promise}>
            <View style={styles.promiseIcon}>
              <PipIcon color={theme.colors.brandInk} name={icon} size={20} />
            </View>
            <Text style={styles.promiseCopy}>{copy}</Text>
          </View>
        ))}
      </View>

      <View style={styles.account}>
        <Text style={styles.accountText}>
          {`${pipBrand.name} works on this device without an account. Create one only if you want a backup, or to use ${pipBrand.name} on another device.`}
        </Text>
        <QuietButton label="Create an account" onPress={() => router.push('/sign-up')} />
      </View>
    </PageShell>
  );
}

const styles = StyleSheet.create({
  hero: { alignItems: 'center', gap: theme.spacing[8], paddingBottom: theme.spacing[8], paddingTop: theme.spacing[24] },
  tagline: { color: theme.colors.secondaryText, textAlign: 'center', ...theme.typography.body },
  promises: { gap: theme.spacing[16] },
  promise: { alignItems: 'center', flexDirection: 'row', gap: theme.spacing[12] },
  promiseIcon: {
    alignItems: 'center',
    backgroundColor: theme.colors.brandPrimarySoft,
    borderRadius: theme.radii.control,
    height: 40,
    justifyContent: 'center',
    width: 40,
  },
  promiseCopy: { color: theme.colors.primaryText, flex: 1, ...theme.typography.body },
  account: {
    backgroundColor: theme.colors.cardSurface,
    borderColor: theme.colors.border,
    borderRadius: theme.radii.card,
    borderWidth: 1,
    gap: theme.spacing[4],
    padding: theme.spacing[16],
  },
  accountText: { color: theme.colors.secondaryText, ...theme.typography.meta },
  footnote: { color: theme.colors.mutedText, textAlign: 'center', ...theme.typography.meta },
});
