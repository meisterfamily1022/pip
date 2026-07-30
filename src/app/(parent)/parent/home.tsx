import { router } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

import { HouseIcon, SlidersIcon, SparkleIcon, ToyBoxIcon } from '@/design/icons';
import { Body, DisplayTitle, HeroCard, ModeBadge, NavCard, Screen } from '@/design/primitives';
import { colors, fontSizes, fonts, radii, spacing } from '@/design/tokens';

/**
 * Parent Home — the entry point of Parent Mode.
 *
 * A calm welcome, then the four places a grown-up can go: the toy library,
 * rooms and storage, the child-facing experience, and settings.
 */
export default function ParentHomeRoute() {
  return (
    <Screen mode="parent">
      <ModeBadge mode="parent" />
      <View style={styles.intro}>
        <DisplayTitle>A calmer way to keep play organized.</DisplayTitle>
        <Body style={styles.lede}>Start with the library, then let Child Mode do the simple part.</Body>
      </View>

      <HeroCard colors={[colors.peach, colors.blush]} style={styles.hero}>
        <View style={styles.heroRow}>
          <View style={styles.heroIcon}>
            <ToyBoxIcon size={34} color={colors.textOnAccent} />
          </View>
          <View style={styles.heroText}>
            <Text accessibilityRole="header" style={styles.heroTitle}>
              Everything has a home.
            </Text>
            <Body style={styles.heroBody}>
              A small toy library makes choosing, finding, and putting things away feel lighter.
            </Body>
          </View>
        </View>
      </HeroCard>

      <View style={styles.sectionHeader}>
        <Text accessibilityRole="header" style={styles.sectionTitle}>
          Your play space
        </Text>
        <Body style={styles.sectionSubtitle}>Choose where you want to go.</Body>
      </View>

      <View style={styles.cards}>
        <NavCard
          icon={ToyBoxIcon}
          onPress={() => router.push('/parent/toy-library')}
          subtitle="Add, find, and manage toys"
          tint="sage"
          title="Toy library"
        />
        <NavCard
          icon={HouseIcon}
          onPress={() => router.push('/parent/locations')}
          subtitle="Keep every toy easy to find"
          tint="butter"
          title="Rooms & storage"
        />
        <NavCard
          icon={SparkleIcon}
          onPress={() => router.push('/child/home')}
          subtitle="See the calm, photo-led experience"
          tint="peach"
          title="Child mode"
        />
        <NavCard
          icon={SlidersIcon}
          onPress={() => router.push('/parent/settings')}
          subtitle="Choices, cleanup, and parent access"
          tint="lilac"
          title="Settings"
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  cards: { gap: 14 },
  hero: { marginBottom: spacing.xxxl },
  heroBody: { fontSize: fontSizes.bodySmall },
  heroIcon: {
    alignItems: 'center',
    backgroundColor: colors.terracotta,
    borderRadius: radii.tile,
    elevation: 4,
    height: 72,
    justifyContent: 'center',
    shadowColor: colors.terracotta,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 16,
    width: 72,
  },
  heroRow: { alignItems: 'center', flexDirection: 'row', gap: spacing.xxl },
  heroText: { flex: 1, gap: 6 },
  heroTitle: { color: colors.textPrimary, fontFamily: fonts.heading, fontSize: fontSizes.panelTitle, fontWeight: '700' },
  intro: { gap: spacing.md, marginBottom: spacing.xxxl, marginTop: spacing.sm },
  lede: { fontSize: fontSizes.bodyLarge, lineHeight: 27 },
  sectionHeader: { gap: spacing.xs, marginBottom: spacing.xl },
  sectionSubtitle: { fontSize: fontSizes.bodySmall },
  sectionTitle: {
    color: colors.textPrimary,
    fontFamily: fonts.heading,
    fontSize: fontSizes.subheading,
    fontWeight: '700',
  },
});
