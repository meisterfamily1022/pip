import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { ChildModeHeader, ChildPage } from '@/components/child-ui';
import { PipIcon, type PipIconName } from '@/components/pip-icon';
import type { PlayCategory } from '@/domain/play-category';
import { playmapTheme as theme } from '@/theme/playmap-theme';

/**
 * What kind of play.
 *
 * Icon-led, because this screen has to work for a child who cannot read the
 * labels. Every tile carries both, and the tint is decoration — the icon and
 * the word are what distinguish them.
 */
type Choice = {
  label: string;
  category: PlayCategory | 'anything';
  icon: PipIconName;
  surface: string;
  border: string;
};

const choices: readonly Choice[] = [
  { label: 'Quiet', category: 'quiet', icon: 'quiet', surface: '#EFF7EE', border: '#D6E7D3' },
  { label: 'Active', category: 'active', icon: 'active', surface: '#E8F6FC', border: '#C6E4F2' },
  { label: 'Build', category: 'building', icon: 'building', surface: '#FFF7E6', border: '#F0DDB0' },
  { label: 'Make', category: 'creative', icon: 'creative', surface: '#F4EFFC', border: '#C9B6EA' },
  { label: 'Pretend', category: 'pretend', icon: 'pretend', surface: '#FBEFF3', border: '#EBD0D9' },
  { label: 'Touch & feel', category: 'sensory', icon: 'sensory', surface: '#EFF7EE', border: '#D6E7D3' },
  { label: 'On my own', category: 'independent', icon: 'independent', surface: '#E8F6FC', border: '#C6E4F2' },
  { label: 'Together', category: 'together', icon: 'together', surface: '#F4EFFC', border: '#C9B6EA' },
  { label: 'Inside', category: 'indoor', icon: 'indoor', surface: '#FFF7E6', border: '#F0DDB0' },
  { label: 'Outside', category: 'outdoor', icon: 'outdoor', surface: '#EFF7EE', border: '#D6E7D3' },
];

export default function ChildCategoriesRoute() {
  return (
    <ChildPage>
      <ChildModeHeader backLabel="Back" onBack={() => router.replace('/child/home')} />
      <Text accessibilityRole="header" style={styles.title}>What kind of play?</Text>

      <View style={styles.grid}>
        {choices.map((choice) => (
          <Pressable
            accessibilityLabel={choice.label}
            accessibilityRole="button"
            key={choice.category}
            onPress={() => router.push({ pathname: '/child/toy-suggestions', params: { category: choice.category } })}
            style={({ pressed }) => [styles.tile, pressed && styles.pressed]}
          >
            <View style={[styles.tileIcon, { backgroundColor: choice.surface, borderColor: choice.border }]}>
              <PipIcon color={theme.colors.primaryText} name={choice.icon} size={30} strokeWidth={1.9} />
            </View>
            <Text numberOfLines={2} style={styles.tileLabel}>{choice.label}</Text>
          </Pressable>
        ))}

        <Pressable
          accessibilityLabel="Show me anything"
          accessibilityRole="button"
          onPress={() => router.push({ pathname: '/child/toy-suggestions', params: { category: 'anything' } })}
          style={({ pressed }) => [styles.anything, pressed && styles.pressed]}
        >
          <PipIcon color={theme.colors.brandPrimaryLabel} name="sparkle" size={26} strokeWidth={1.9} />
          <Text style={styles.anythingLabel}>Show me anything</Text>
        </Pressable>
      </View>
    </ChildPage>
  );
}

const styles = StyleSheet.create({
  pressed: { opacity: 0.78 },
  title: { color: theme.colors.primaryText, ...theme.typography.childTitle, fontSize: 30, lineHeight: 34 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing[12] },
  tile: {
    alignItems: 'center',
    backgroundColor: theme.colors.cardSurface,
    borderColor: theme.colors.border,
    borderRadius: 20,
    borderWidth: 1,
    flexBasis: '46%',
    flexGrow: 1,
    gap: theme.spacing[8],
    minHeight: 128,
    justifyContent: 'center',
    padding: theme.spacing[16],
  },
  tileIcon: {
    alignItems: 'center',
    borderRadius: 18,
    borderWidth: 1,
    height: 60,
    justifyContent: 'center',
    width: 60,
  },
  tileLabel: { color: theme.colors.primaryText, textAlign: 'center', ...theme.typography.rowTitle },
  anything: {
    alignItems: 'center',
    backgroundColor: theme.colors.accentSunshine,
    borderColor: theme.colors.borderSunshine,
    borderRadius: 20,
    borderWidth: 1,
    flexDirection: 'row',
    gap: theme.spacing[12],
    justifyContent: 'center',
    minHeight: 72,
    padding: theme.spacing[16],
    width: '100%',
  },
  anythingLabel: { color: theme.colors.brandPrimaryLabel, ...theme.typography.rowTitle, fontSize: 19 },
});
