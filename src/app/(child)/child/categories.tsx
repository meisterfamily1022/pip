import { router } from 'expo-router';
import { StyleSheet, Text, View, useWindowDimensions } from 'react-native';

import { SparkleIcon } from '@/design/icons';
import { BackPill, Body, CategoryTile, Eyebrow, Screen, ScreenTitle } from '@/design/primitives';
import { colors, fontSizes, spacing } from '@/design/tokens';
import { PLAY_CHOICES, type PlayChoice } from '@/features/play/play-choices';

/** Below this width the tiles stay in one child-friendly column. */
const TWO_COLUMN_WIDTH = 640;

export default function ChildCategoriesRoute() {
  const { width } = useWindowDimensions();
  const twoColumn = width >= TWO_COLUMN_WIDTH;

  const goHome = (): void => {
    if (router.canGoBack()) router.back();
    else router.replace('/child/home');
  };

  const choose = (choice: PlayChoice): void => {
    router.push({ pathname: '/child/toy-suggestions', params: { choice: choice.id } });
  };

  return (
    <Screen mode="child">
      <View style={styles.header}>
        <BackPill label="Home" onPress={goHome} />
        <View style={styles.marker}>
          <SparkleIcon size={13} color={colors.terracotta} />
          <Text style={styles.markerText}>CHILD MODE</Text>
        </View>
      </View>

      <Eyebrow>CHOOSE A PLAY TYPE</Eyebrow>
      <View style={styles.heading}>
        <ScreenTitle>What sounds good?</ScreenTitle>
      </View>
      <Body>Pick one kind of play.</Body>

      <View style={styles.grid}>
        {PLAY_CHOICES.map((choice) => (
          <View key={choice.id} style={twoColumn ? styles.gridItemHalf : styles.gridItemFull}>
            <CategoryTile
              icon={choice.icon}
              label={choice.label}
              onPress={() => choose(choice)}
              tint={choice.tint}
            />
          </View>
        ))}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.lg, marginTop: spacing.xxl },
  gridItemFull: { width: '100%' },
  gridItemHalf: { flexBasis: '47%', flexGrow: 1 },
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.xl,
  },
  heading: { marginTop: spacing.sm },
  marker: { alignItems: 'center', flexDirection: 'row', gap: 5 },
  markerText: { color: colors.terracotta, fontSize: fontSizes.badge, fontWeight: '800', letterSpacing: 1 },
});
