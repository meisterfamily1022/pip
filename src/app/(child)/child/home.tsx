import { useEffect, useState } from 'react';
import { router } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { ChildActionCard, ErrorStateCard, LoadingState } from '@/components/playmap-ui';
import { initializeDatabase } from '@/database/client';
import { getActivePlaySession } from '@/repositories/play-sessions-repository';
import { getSettings } from '@/repositories/settings-repository';
import { playmapTheme as theme, screenContentStyle } from '@/theme/playmap-theme';

export default function ChildHomeRoute() {
  const [nickname, setNickname] = useState<string | null>(null); const [hasActive, setHasActive] = useState(false); const [loading, setLoading] = useState(true); const [error, setError] = useState<string | null>(null);
  useEffect(() => { initializeDatabase().then(async (db) => { const [settings, active] = await Promise.all([getSettings(db), getActivePlaySession(db)]); setNickname(settings.childNickname); setHasActive(active !== null); }).catch((caught: unknown) => setError(caught instanceof Error ? caught.message : 'Could not load Child Mode.')).finally(() => setLoading(false)); }, []);
  if (loading) return <LoadingState label="Loading Child Mode…" />;
  if (error) return <ErrorStateCard message={error} action={<Pressable accessibilityRole="button" onPress={() => router.replace('/child/home')} style={styles.retry}><Text style={styles.parentText}>Try Again</Text></Pressable>} />;
  return <ScrollView contentInsetAdjustmentBehavior="automatic" contentContainerStyle={styles.container}>
    <View style={styles.sky}><Text style={styles.greeting}>🦁  Hi{nickname ? ` ${nickname}` : ''}!</Text><Text style={styles.cloud}>☁️</Text><Text style={styles.sun}>☀️</Text><Text accessibilityRole="header" style={styles.title}>What sounds fun today?</Text><Text style={styles.fox}>🦊</Text></View>
    <View style={styles.actions}>
      <ChildActionCard icon="⌕" title="Find a Toy" description="Choose what sounds fun" tint={theme.colors.mintSoft} onPress={() => router.push('/child/categories')} />
      <ChildActionCard icon="🎁" title="Surprise Me" description="Pick something random!" tint={theme.colors.yellowSoft} onPress={() => router.push({ pathname: '/child/toy-suggestions', params: { category: 'anything', surprise: '1' } })} />
      <ChildActionCard disabled={!hasActive} icon="★" title="Current Toy" description={hasActive ? 'See what you’re playing with' : 'Nothing is being played with'} tint={theme.colors.peachSoft} onPress={() => router.push('/child/current-toy')} />
    </View>
    <Pressable accessibilityRole="button" onPress={() => router.push('../child/parent-return')} style={styles.parent}><Text style={styles.parentText}>Grown-up area</Text></Pressable>
  </ScrollView>;
}

const styles = StyleSheet.create({
  retry: { alignItems: 'center', justifyContent: 'center', minHeight: 44, paddingHorizontal: 12 },
  container: { ...screenContentStyle, backgroundColor: theme.colors.childBackground, flexGrow: 1, gap: 16 },
  sky: { alignItems: 'center', backgroundColor: '#EAF5F4', borderRadius: theme.radii.xl, minHeight: 290, overflow: 'hidden', padding: 22 },
  greeting: { alignSelf: 'flex-start', color: theme.colors.text, fontSize: 17, fontWeight: '700' }, cloud: { fontSize: 46, left: 32, opacity: 0.8, position: 'absolute', top: 58 }, sun: { fontSize: 45, position: 'absolute', right: 30, top: 62 },
  title: { color: theme.colors.primary, fontFamily: 'Georgia', fontSize: theme.type.childTitle, fontWeight: '700', lineHeight: 43, maxWidth: 330, paddingTop: 48, textAlign: 'center' }, fox: { fontSize: 76, paddingTop: 14 },
  actions: { gap: 12 },
  parent: { alignItems: 'center', minHeight: 48, justifyContent: 'center' }, parentText: { color: theme.colors.mutedText, fontSize: 15, fontWeight: '600' },
});
