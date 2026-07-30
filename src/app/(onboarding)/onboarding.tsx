import { router } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

import { OnboardingScreen } from '@/components/onboarding-screen';
import { ToyBoxIcon } from '@/design/icons';
import { Body, HeroCard, PrimaryButton } from '@/design/primitives';
import { accentShadow, colors, fontSizes, fonts, spacing } from '@/design/tokens';

const HERO_GRADIENT = [colors.peach, colors.blush] as const;

export default function OnboardingHomeRoute() {
  return (
    <OnboardingScreen
      footer={<PrimaryButton label="Set Up PlayMap" onPress={() => router.push('/parent-pin-setup')} />}
      title="PlayMap"
    >
      <HeroCard colors={HERO_GRADIENT}>
        <View style={styles.hero}>
          <View style={styles.heroIcon}>
            <ToyBoxIcon size={34} color={colors.textOnAccent} />
          </View>
          <View style={styles.heroText}>
            <Text style={styles.heroTitle}>Everything has a home.</Text>
            <Text style={styles.heroBody}>
              Photograph your child’s toys, organize where they belong, and give your child a simpler way to choose what
              to play with.
            </Text>
          </View>
        </View>
      </HeroCard>
      <Body>Let’s get the basics ready.</Body>
    </OnboardingScreen>
  );
}

const styles = StyleSheet.create({
  hero: { alignItems: 'center', flexDirection: 'row', gap: spacing.xxl },
  heroBody: { color: colors.textSecondary, fontSize: fontSizes.bodySmall, lineHeight: 23 },
  heroIcon: {
    alignItems: 'center',
    backgroundColor: colors.terracotta,
    borderRadius: spacing.xl,
    height: 72,
    justifyContent: 'center',
    width: 72,
    ...accentShadow,
  },
  heroText: { flex: 1, gap: 6 },
  heroTitle: { color: colors.textPrimary, fontFamily: fonts.heading, fontSize: 21, fontWeight: '700' },
});
