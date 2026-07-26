import { useEffect, useState } from 'react';
import { router } from 'expo-router';
import { ActivityIndicator, SafeAreaView, StyleSheet, Text, View } from 'react-native';
import { ChildButton } from '@/components/child-ui';
import { initializeDatabase } from '@/database/client';
import { getActivePlaySession } from '@/repositories/play-sessions-repository';
import { getSettings } from '@/repositories/settings-repository';

export default function ChildHomeRoute() {
  const [nickname, setNickname] = useState<string | null>(null); const [hasActive, setHasActive] = useState(false); const [loading, setLoading] = useState(true); const [error, setError] = useState<string | null>(null);
  useEffect(() => { initializeDatabase().then(async (db) => { const [settings, active] = await Promise.all([getSettings(db), getActivePlaySession(db)]); setNickname(settings.childNickname); setHasActive(active !== null); }).catch((caught: unknown) => setError(caught instanceof Error ? caught.message : 'Could not load Child Mode.')).finally(() => setLoading(false)); }, []);
  if (loading) return <SafeAreaView style={styles.center}><ActivityIndicator /><Text>Loading Child Mode…</Text></SafeAreaView>;
  if (error) return <SafeAreaView style={styles.center}><Text style={styles.error}>{error}</Text><ChildButton label="Try Again" onPress={() => router.replace('/child/home')} /></SafeAreaView>;
  return <SafeAreaView style={styles.container}><Text accessibilityRole="header" style={styles.title}>{nickname ? `What would you like to play with, ${nickname}?` : 'What would you like to play with?'}</Text><View style={styles.actions}><ChildButton label="Find Something to Play With" onPress={() => router.push('/child/categories')} /><ChildButton label="Surprise Me" onPress={() => router.push({ pathname: '/child/toy-suggestions', params: { category: 'anything' } })} /><ChildButton label="Current Toy" disabled={!hasActive} onPress={() => router.push('/child/current-toy')} /><ChildButton label="Parent Mode" secondary onPress={() => router.push('../child/parent-return')} /></View></SafeAreaView>;
}
const styles = StyleSheet.create({ container: { flex: 1, gap: 28, padding: 24, paddingTop: 60 }, center: { flex: 1, alignItems: 'center', gap: 16, justifyContent: 'center', padding: 24 }, title: { color: '#1A1A1F', fontSize: 30, fontWeight: '700', lineHeight: 38 }, actions: { gap: 14 }, error: { color: '#A52222', fontSize: 17, textAlign: 'center' } });
