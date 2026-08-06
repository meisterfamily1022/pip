import { router } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

import { PrimaryButton } from '@/components/onboarding-controls';
import { OnboardingScreen } from '@/components/onboarding-screen';
import { PipBrandMark } from '@/components/pip-brand-mark';
import { pipBrand } from '@/brand/pip-brand';
import { playmapTheme as theme } from '@/theme/playmap-theme';

export default function OnboardingHomeRoute() {
  return <OnboardingScreen title="Welcome to Pip" description="Photograph your child’s toys, organize where they belong, and give your child a simpler way to choose what to play with." footer={<PrimaryButton label="Set Up Pip" onPress={() => router.push('/parent-pin-setup')} />}><View style={styles.hero}><PipBrandMark style={styles.wordmark} /></View><Text style={styles.ready}>{pipBrand.primaryTagline}</Text></OnboardingScreen>;
}

const styles = StyleSheet.create({
  hero: { alignItems: 'center', backgroundColor: theme.colors.surface, borderColor: theme.colors.border, borderRadius: theme.radii.card, borderWidth: 1, justifyContent: 'center', minHeight: 210, padding: theme.spacing[24] },
  wordmark: { maxWidth: 300 },
  ready: { color: theme.colors.primaryText, fontFamily: 'Georgia', fontSize: 20, fontWeight: '700' },
});
