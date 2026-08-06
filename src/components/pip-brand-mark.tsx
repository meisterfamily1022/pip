import { ActivityIndicator, Image, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { playmapTheme as theme } from '@/theme/playmap-theme';

type PipBrandMarkVariant = 'lockup' | 'wordmark' | 'symbol';

const nativeSources = {
  lockup: require('../../assets/brand/generated/pip-lockup.png'),
  wordmark: require('../../assets/brand/generated/pip-wordmark.png'),
  symbol: require('../../assets/brand/generated/pip-symbol.png'),
} as const;

const aspectRatios: Record<PipBrandMarkVariant, number> = {
  lockup: 1200 / 1089,
  wordmark: 1200 / 963,
  symbol: 512 / 555,
};

export function PipBrandMark({ variant = 'wordmark', style }: { variant?: PipBrandMarkVariant; style?: StyleProp<ViewStyle> }) {
  const label = variant === 'lockup' ? 'Pip. Less deciding. More playing.' : variant === 'symbol' ? 'Pip symbol' : 'Pip';
  return <View style={[styles.frame, { aspectRatio: aspectRatios[variant] }, style]}><Image accessibilityLabel={label} resizeMode="contain" source={nativeSources[variant]} style={styles.image} /></View>;
}

export function PipLaunchState({ label = 'Starting Pip…' }: { label?: string }) {
  return <View accessibilityLabel={label} accessibilityLiveRegion="polite" accessibilityRole="progressbar" style={styles.launch}><PipBrandMark variant="symbol" style={styles.launchSymbol} /><ActivityIndicator color={theme.colors.brandInk} /><Text style={styles.launchText}>{label}</Text></View>;
}

const styles = StyleSheet.create({ frame: { alignSelf: 'center', maxWidth: '100%', width: '100%' }, image: { height: '100%', width: '100%' }, launch: { alignItems: 'center', flex: 1, gap: 14, justifyContent: 'center', padding: theme.spacing[24] }, launchSymbol: { width: 72 }, launchText: { color: theme.colors.secondaryText, ...theme.typography.supporting } });
