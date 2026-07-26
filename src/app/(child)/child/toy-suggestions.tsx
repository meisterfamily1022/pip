import { useEffect, useState } from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import { ActivityIndicator, SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';
import { ChildButton, ToyCard } from '@/components/child-ui';
import { initializeDatabase } from '@/database/client';
import { recommendToys, safeChoiceLimit, type PlayType } from '@/features/child/recommendation-service';
import { getSettings } from '@/repositories/settings-repository';
import { listChildToys, type ChildToy } from '@/repositories/toys-repository';

type LoadedRecommendations = { toys: ChildToy[]; shown: number[] };

async function loadRecommendations(category: PlayType, dismissed: readonly number[]): Promise<LoadedRecommendations> {
  const database = await initializeDatabase();
  const [allToys, settings] = await Promise.all([listChildToys(database), getSettings(database)]);
  const toys = recommendToys(allToys, { category, choiceLimit: safeChoiceLimit(settings.choiceLimit), dismissedIds: dismissed });
  return { toys, shown: [...dismissed, ...toys.map((toy) => toy.id)] };
}

export default function ChildToySuggestionsRoute() {
  const params = useLocalSearchParams<{ category?: string }>();
  const category = (params.category ?? 'anything') as PlayType;
  const [toys, setToys] = useState<ChildToy[]>([]);
  const [shown, setShown] = useState<number[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    void loadRecommendations(category, []).then((result) => { if (mounted) { setToys(result.toys); setShown(result.shown); setLoading(false); } }).catch((caught: unknown) => { if (mounted) { setError(caught instanceof Error ? caught.message : 'Could not find toys.'); setLoading(false); } });
    return () => { mounted = false; };
  }, [category]);

  const different = async (): Promise<void> => {
    setLoading(true); setError(null);
    try { const result = await loadRecommendations(category, shown); setToys(result.toys); setShown(result.shown); } catch (caught: unknown) { setError(caught instanceof Error ? caught.message : 'Could not find toys.'); } finally { setLoading(false); }
  };

  if (loading) return <SafeAreaView style={styles.center}><ActivityIndicator /><Text>Finding toys…</Text></SafeAreaView>;
  if (error) return <SafeAreaView style={styles.center}><Text style={styles.error}>{error}</Text><ChildButton label="Try Again" onPress={() => void different()} /></SafeAreaView>;
  if (toys.length === 0) return <ScrollView contentContainerStyle={styles.container}><Text accessibilityRole="header" style={styles.title}>No toys match this choice yet.</Text><View style={styles.actions}><ChildButton label="Choose Another Type" onPress={() => router.replace('/child/categories')} /><ChildButton label="Show Me Anything" onPress={() => router.replace({ pathname: '/child/toy-suggestions', params: { category: 'anything' } })} /><ChildButton label="Return Home" secondary onPress={() => router.replace('/child/home')} /></View></ScrollView>;
  return <ScrollView contentContainerStyle={styles.container}><Text accessibilityRole="header" style={styles.title}>Choose something to play with</Text><View style={styles.grid}>{toys.map((toy) => <ToyCard key={toy.id} toy={toy} onPress={() => router.push({ pathname: '/child/toy-detail', params: { id: String(toy.id) } })} />)}</View><View style={styles.actions}><ChildButton label="Show Me Different Toys" onPress={() => void different()} /><ChildButton label="Choose Another Type" secondary onPress={() => router.replace('/child/categories')} /><ChildButton label="Return Home" secondary onPress={() => router.replace('/child/home')} /></View></ScrollView>;
}

const styles = StyleSheet.create({ container: { gap: 20, padding: 20, paddingTop: 52 }, center: { flex: 1, alignItems: 'center', gap: 16, justifyContent: 'center', padding: 24 }, title: { fontSize: 30, fontWeight: '700', lineHeight: 38 }, grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, justifyContent: 'space-between' }, actions: { gap: 12 }, error: { color: '#A52222', fontSize: 17, textAlign: 'center' } });
