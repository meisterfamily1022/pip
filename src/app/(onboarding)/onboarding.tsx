import { router } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

import { PrimaryButton } from '@/components/onboarding-controls';
import { OnboardingScreen } from '@/components/onboarding-screen';
import { playmapTheme as theme } from '@/theme/playmap-theme';

export default function OnboardingHomeRoute() {
  return <OnboardingScreen title="PlayMap" description="Photograph your child’s toys, organize where they belong, and give your child a simpler way to choose what to play with." footer={<PrimaryButton label="Set Up PlayMap" onPress={() => router.push('/parent-pin-setup')} />}><View accessibilityLabel="Toy blocks resting on a play mat" style={styles.hero}><View style={styles.mat} /><View style={styles.blockOne} /><View style={styles.blockTwo} /><View style={styles.ball} /></View><Text style={styles.ready}>Let’s get the basics ready.</Text></OnboardingScreen>;
}

const styles = StyleSheet.create({
  hero: { backgroundColor: theme.colors.surfaceSage, borderRadius: theme.radii.card, height: 210, overflow: 'hidden', position: 'relative' },
  mat: { backgroundColor: theme.colors.surfaceMint, borderRadius: 180, bottom: -76, height: 190, left: -30, position: 'absolute', width: '112%' },
  blockOne: { backgroundColor: theme.colors.peach, borderRadius: 14, bottom: 52, height: 76, left: '29%', position: 'absolute', transform: [{ rotate: '-9deg' }], width: 76 },
  blockTwo: { backgroundColor: theme.colors.lavender, borderRadius: 14, bottom: 48, height: 60, left: '48%', position: 'absolute', transform: [{ rotate: '8deg' }], width: 60 },
  ball: { backgroundColor: theme.colors.yellow, borderRadius: 34, bottom: 56, height: 68, position: 'absolute', right: '20%', width: 68 },
  ready: { color: theme.colors.primaryText, fontFamily: 'Georgia', fontSize: 20, fontWeight: '700' },
});
