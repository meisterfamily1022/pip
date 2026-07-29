import { useEffect, useState } from 'react';
import { router } from 'expo-router';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { ChildButton } from '@/components/child-ui';
import { initializeDatabase } from '@/database/client';
import { getActivePlaySession } from '@/repositories/play-sessions-repository';
import { getSettings } from '@/repositories/settings-repository';
import { playmapTheme as theme, screenContentStyle } from '@/theme/playmap-theme';

export default function ChildHomeRoute() {
  const [nickname, setNickname] = useState<string | null>(null); const [hasActive, setHasActive] = useState(false); const [loading, setLoading] = useState(true); const [error, setError] = useState<string | null>(null);
  useEffect(() => { initializeDatabase().then(async (db) => { const [settings, active] = await Promise.all([getSettings(db), getActivePlaySession(db)]); setNickname(settings.childNickname); setHasActive(active !== null); }).catch((caught: unknown) => setError(caught instanceof Error ? caught.message : 'Could not load Child Mode.')).finally(() => setLoading(false)); }, []);
  if (loading) return <View style={styles.center}><ActivityIndicator /><Text>Loading Child Mode…</Text></View>;
  if (error) return <View style={styles.center}><Text style={styles.error}>{error}</Text><ChildButton label="Try Again" onPress={() => router.replace('/child/home')} /></View>;
  return <ScrollView contentInsetAdjustmentBehavior="automatic" contentContainerStyle={styles.container}>
    <View style={styles.sky}><Text style={styles.greeting}>🦁  Hi{nickname ? ` ${nickname}` : ''}!</Text><Text style={styles.cloud}>☁️</Text><Text style={styles.sun}>☀️</Text><Text accessibilityRole="header" style={styles.title}>What sounds fun today?</Text><Text style={styles.fox}>🦊</Text></View>
    <View style={styles.actions}>
      <ActionCard icon="⌕" title="Find a Toy" subtitle="Choose what sounds fun" tint={theme.colors.mintSoft} onPress={() => router.push('/child/categories')} />
      <ActionCard icon="🎁" title="Surprise Me" subtitle="Pick something random!" tint={theme.colors.yellowSoft} onPress={() => router.push({ pathname: '/child/toy-suggestions', params: { category: 'anything', surprise: '1' } })} />
      <ActionCard icon="★" title="Current Toy" subtitle={hasActive ? 'See what you’re playing with' : 'Nothing is being played with'} tint={theme.colors.peachSoft} disabled={!hasActive} onPress={() => router.push('/child/current-toy')} />
    </View>
    <Pressable accessibilityRole="button" onPress={() => router.push('../child/parent-return')} style={styles.parent}><Text style={styles.parentText}>Grown-up area</Text></Pressable>
  </ScrollView>;
}

function ActionCard({ icon, title, subtitle, tint, onPress, disabled = false }: { icon: string; title: string; subtitle: string; tint: string; onPress(): void; disabled?: boolean }) {
  return <Pressable accessibilityRole="button" disabled={disabled} onPress={onPress} style={({ pressed }) => [styles.action, { backgroundColor: tint }, disabled && styles.disabled, pressed && styles.pressed]}><Text style={styles.actionIcon}>{icon}</Text><View style={styles.actionText}><Text style={styles.actionTitle}>{title}</Text><Text style={styles.actionSubtitle}>{subtitle}</Text></View><Text style={styles.chevron}>›</Text></Pressable>;
}
const styles = StyleSheet.create({
  container: { ...screenContentStyle, backgroundColor: theme.colors.childBackground, flexGrow: 1, gap: 16 },
  center: { alignItems: 'center', backgroundColor: theme.colors.childBackground, flex: 1, gap: 16, justifyContent: 'center', padding: 24 },
  sky: { alignItems: 'center', backgroundColor: '#EAF5F4', borderRadius: theme.radii.xl, minHeight: 290, overflow: 'hidden', padding: 22 },
  greeting: { alignSelf: 'flex-start', color: theme.colors.text, fontSize: 17, fontWeight: '700' }, cloud: { fontSize: 46, left: 32, opacity: 0.8, position: 'absolute', top: 58 }, sun: { fontSize: 45, position: 'absolute', right: 30, top: 62 },
  title: { color: theme.colors.primary, fontFamily: 'Georgia', fontSize: theme.type.childTitle, fontWeight: '700', lineHeight: 43, maxWidth: 330, paddingTop: 48, textAlign: 'center' }, fox: { fontSize: 76, paddingTop: 14 },
  actions: { gap: 12 }, action: { ...theme.shadows.card, alignItems: 'center', borderColor: 'rgba(85,95,80,0.08)', borderRadius: theme.radii.lg, borderWidth: 1, flexDirection: 'row', gap: 16, minHeight: 104, padding: 18 },
  actionIcon: { color: theme.colors.primary, fontSize: 36, textAlign: 'center', width: 48 }, actionText: { flex: 1, gap: 5 }, actionTitle: { color: theme.colors.text, fontFamily: 'Georgia', fontSize: 22, fontWeight: '700' }, actionSubtitle: { color: theme.colors.mutedText, fontSize: 14 }, chevron: { color: theme.colors.mutedText, fontSize: 32 },
  parent: { alignItems: 'center', minHeight: 48, justifyContent: 'center' }, parentText: { color: theme.colors.mutedText, fontSize: 15, fontWeight: '600' }, disabled: { opacity: 0.48 }, pressed: { opacity: 0.8 }, error: { color: theme.colors.danger, fontSize: 17, textAlign: 'center' },
});
