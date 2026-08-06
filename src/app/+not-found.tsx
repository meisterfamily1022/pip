import { Link } from 'expo-router';
import { SafeAreaView, StyleSheet, Text, View } from 'react-native';
import { PrimaryButton } from '@/components/playmap-ui';
import { playmapTheme as theme } from '@/theme/playmap-theme';

export default function NotFoundRoute() {
  return <SafeAreaView style={styles.page}><View style={styles.card}><Text accessibilityRole="header" style={styles.title}>That page is not here</Text><Text style={styles.copy}>Let’s get you back to PlayMap.</Text><Link href="/" asChild><PrimaryButton label="Go to PlayMap" onPress={() => {}} /></Link></View></SafeAreaView>;
}

const styles = StyleSheet.create({ page: { alignItems: 'center', backgroundColor: theme.colors.background, flex: 1, justifyContent: 'center', padding: 20 }, card: { ...theme.shadows.card, backgroundColor: theme.colors.surface, borderColor: theme.colors.border, borderRadius: theme.radii.lg, borderWidth: 1, gap: 12, maxWidth: 440, padding: 24, width: '100%' }, title: { color: theme.colors.primaryText, fontSize: 26, fontWeight: '700' }, copy: { color: theme.colors.secondaryText, fontSize: 17, lineHeight: 24 } });
