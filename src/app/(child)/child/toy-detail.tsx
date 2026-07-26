import { useEffect, useState } from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import { ActivityIndicator, SafeAreaView, ScrollView, StyleSheet, Text } from 'react-native';
import { ChildButton, ToyImage } from '@/components/child-ui';
import { initializeDatabase } from '@/database/client';
import { getActivePlaySession, startPlaySessionIfNoneActive } from '@/repositories/play-sessions-repository';
import { listChildToys, type ChildToy } from '@/repositories/toys-repository';

export default function ChildToyDetailRoute() {
  const { id } = useLocalSearchParams<{ id?: string }>(); const toyId = Number(id); const [toy, setToy] = useState<ChildToy | null>(null); const [error, setError] = useState<string | null>(null); const [saving, setSaving] = useState(false);
  useEffect(() => { initializeDatabase().then(listChildToys).then((toys) => setToy(toys.find((candidate) => candidate.id === toyId) ?? null)).catch((caught: unknown) => setError(caught instanceof Error ? caught.message : 'Could not load this toy.')); }, [toyId]);
  const found = async (): Promise<void> => { if (!toy || saving) return; setSaving(true); setError(null); try { const db = await initializeDatabase(); const current = await listChildToys(db); const fresh = current.find((candidate) => candidate.id === toy.id); if (!fresh) throw new Error('This toy is no longer available.'); const active = await getActivePlaySession(db); if (active) { router.replace('/child/current-toy'); return; } await startPlaySessionIfNoneActive(db, fresh.id); router.replace('/child/current-toy'); } catch (caught: unknown) { setError(caught instanceof Error ? caught.message : 'Could not start play.'); setSaving(false); } };
  if (error) return <SafeAreaView style={styles.center}><Text style={styles.error}>{error}</Text><ChildButton label="Choose Something Else" onPress={() => router.back()} /></SafeAreaView>;
  if (!toy) return <SafeAreaView style={styles.center}><ActivityIndicator /><Text>Loading toy…</Text></SafeAreaView>;
  return <ScrollView contentContainerStyle={styles.container}><ToyImage uri={toy.imageUri} /><Text accessibilityRole="header" style={styles.title}>{toy.name}</Text><Text style={styles.location}>{toy.roomName} → {toy.storageSpotName}</Text><ChildButton label={saving ? 'Starting…' : 'I Found It'} disabled={saving} onPress={() => void found()} /><ChildButton label="Choose Something Else" secondary onPress={() => router.back()} /></ScrollView>;
}
const styles = StyleSheet.create({ container: { gap: 18, padding: 24, paddingTop: 52 }, center: { flex: 1, alignItems: 'center', gap: 16, justifyContent: 'center', padding: 24 }, title: { fontSize: 34, fontWeight: '700' }, location: { fontSize: 22, fontWeight: '600' }, error: { color: '#A52222', fontSize: 17, textAlign: 'center' } });
