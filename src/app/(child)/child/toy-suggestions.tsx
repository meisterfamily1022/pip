import { useEffect, useState } from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import { ActivityIndicator, SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';
import { ChildButton, ToyCard } from '@/components/child-ui';
import { initializeDatabase } from '@/database/client';
import { recommendToys, safeChoiceLimit, type PlayType } from '@/features/child/recommendation-service';
import { getSettings } from '@/repositories/settings-repository';
import { listChildToys, type ChildToy } from '@/repositories/toys-repository';
import { playmapTheme as theme } from '@/theme/playmap-theme';

type LoadedRecommendations = { toys: ChildToy[]; shown: number[] };

export function childSuggestionLimit(choiceLimit: number, surprise: boolean): number {
  return surprise ? 1 : safeChoiceLimit(choiceLimit);
}

async function loadRecommendations(category: PlayType, dismissed: readonly number[], surprise: boolean): Promise<LoadedRecommendations> {
  const database = await initializeDatabase();
  const [allToys, settings] = await Promise.all([listChildToys(database), getSettings(database)]);
  const toys = recommendToys(allToys, { category, choiceLimit: childSuggestionLimit(settings.choiceLimit, surprise), dismissedIds: dismissed });
  return { toys, shown: [...dismissed, ...toys.map((toy) => toy.id)] };
}

export default function ChildToySuggestionsRoute() {
  const params = useLocalSearchParams<{ category?: string; surprise?: string }>();
  const category = (params.category ?? 'anything') as PlayType;
  const surprise = params.surprise === '1';
  const [toys, setToys] = useState<ChildToy[]>([]);
  const [shown, setShown] = useState<number[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    void loadRecommendations(category, [], surprise).then((result) => { if (mounted) { setToys(result.toys); setShown(result.shown); setLoading(false); } }).catch((caught: unknown) => { if (mounted) { setError(caught instanceof Error ? caught.message : 'Could not find toys.'); setLoading(false); } });
    return () => { mounted = false; };
  }, [category, surprise]);

  const different = async (): Promise<void> => {
    setLoading(true); setError(null);
    try { const result = await loadRecommendations(category, shown, surprise); setToys(result.toys); setShown(result.shown); } catch (caught: unknown) { setError(caught instanceof Error ? caught.message : 'Could not find toys.'); } finally { setLoading(false); }
  };

  if (loading) return <SafeAreaView style={styles.center}><ActivityIndicator color={theme.colors.sageAction} /><Text style={styles.loadingText}>Finding toys…</Text></SafeAreaView>;
  if (error) return <SafeAreaView style={styles.center}><Text style={styles.error}>{error}</Text><ChildButton label="Try Again" onPress={() => void different()} /></SafeAreaView>;
  if (toys.length === 0) return <ScrollView contentContainerStyle={styles.container}><Text style={styles.eyebrow}>TOY IDEAS</Text><Text accessibilityRole="header" style={styles.title}>No toys match this choice yet.</Text><Text style={styles.subtitle}>Try another kind of play.</Text><View style={styles.actions}><ChildButton label="Choose Another Type" onPress={() => router.replace('/child/categories')} /><ChildButton label="Show Me Anything" tint={theme.colors.surfaceYellow} onPress={() => router.replace({ pathname: '/child/toy-suggestions', params: { category: 'anything' } })} /><ChildButton label="Return Home" secondary onPress={() => router.replace('/child/home')} /></View></ScrollView>;
  return <ScrollView contentContainerStyle={styles.container}><Text style={styles.eyebrow}>TOY IDEAS</Text><Text accessibilityRole="header" style={styles.title}>What would you like to play with?</Text><Text style={styles.subtitle}>{surprise ? 'Here is a surprise!' : 'Choose one to get started.'}</Text><View style={styles.grid}>{toys.map((toy) => <ToyCard key={toy.id} toy={toy} onPress={() => router.push({ pathname: '/child/toy-detail', params: { id: String(toy.id) } })} />)}</View><View style={styles.actions}><ChildButton label="Show Me Different Toys" onPress={() => void different()} /><ChildButton label="Choose Another Type" tint={theme.colors.surfaceYellow} onPress={() => router.replace('/child/categories')} /><ChildButton label="Return Home" secondary onPress={() => router.replace('/child/home')} /></View></ScrollView>;
}

const styles = StyleSheet.create({ container: { backgroundColor: theme.colors.childBackground, flexGrow: 1, gap: 10, padding: 20, paddingBottom: 48, paddingTop: 28 }, center: { alignItems: 'center', backgroundColor: theme.colors.childBackground, flex: 1, gap: 16, justifyContent: 'center', padding: 24 }, eyebrow: { color: theme.colors.coralDark, fontSize: 12, fontWeight: '800', letterSpacing: 1.4 }, title: { color: theme.colors.primary, fontFamily: 'Georgia', fontSize: 32, fontWeight: '700', lineHeight: 40, marginBottom: 2 }, subtitle: { color: theme.colors.secondaryText, fontSize: 17, marginBottom: 14 }, loadingText: { color: theme.colors.secondaryText, fontSize: 17 }, grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 14, justifyContent: 'space-between', marginBottom: 8 }, actions: { gap: 12 }, error: { color: theme.colors.error, fontSize: 17, textAlign: 'center' } });
