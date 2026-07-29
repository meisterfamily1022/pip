import { useEffect, useState } from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import { ActivityIndicator, ScrollView, StyleSheet, Text } from 'react-native';
import { ChildButton, ChildPage, LocationPanel, ToyImage } from '@/components/child-ui';
import { playmapTheme as theme } from '@/theme/playmap-theme';
import { initializeDatabase } from '@/database/client';
import { getActivePlaySession, startPlaySessionIfNoneActive } from '@/repositories/play-sessions-repository';
import { listChildToys, type ChildToy } from '@/repositories/toys-repository';

export default function ChildToyDetailRoute() {
  const { id } = useLocalSearchParams<{ id?: string }>(); const toyId = Number(id); const [toy, setToy] = useState<ChildToy | null>(null); const [error, setError] = useState<string | null>(null); const [saving, setSaving] = useState(false);
  useEffect(() => { initializeDatabase().then(listChildToys).then((toys) => setToy(toys.find((candidate) => candidate.id === toyId) ?? null)).catch((caught: unknown) => setError(caught instanceof Error ? caught.message : 'Could not load this toy.')); }, [toyId]);
  const found = async (): Promise<void> => { if (!toy || saving) return; setSaving(true); setError(null); try { const db = await initializeDatabase(); const current = await listChildToys(db); const fresh = current.find((candidate) => candidate.id === toy.id); if (!fresh) throw new Error('This toy is no longer available.'); const active = await getActivePlaySession(db); if (active) { router.replace('/child/current-toy'); return; } await startPlaySessionIfNoneActive(db, fresh.id); router.replace('/child/current-toy'); } catch (caught: unknown) { setError(caught instanceof Error ? caught.message : 'Could not start play.'); setSaving(false); } };
  if (error) return <ChildPage centered><Text style={styles.error}>{error}</Text><ChildButton label="Choose Something Else" onPress={() => router.back()} /></ChildPage>;
  if (!toy) return <ChildPage centered><ActivityIndicator color={theme.colors.sageAction} /><Text>Loading toy…</Text></ChildPage>;
  return <ScrollView contentContainerStyle={styles.container}><Text style={styles.eyebrow}>YOU FOUND A TOY</Text><ToyImage uri={toy.imageUri} /><Text accessibilityRole="header" style={styles.title}>{toy.name}</Text><LocationPanel room={toy.roomName} spot={toy.storageSpotName} /><ChildButton label={saving ? 'Starting…' : 'I Found It'} disabled={saving} onPress={() => void found()} /><ChildButton label="Choose Something Else" secondary onPress={() => router.back()} /></ScrollView>;
}
const styles = StyleSheet.create({ container: { alignItems: 'stretch', backgroundColor: theme.colors.childBackground, flexGrow: 1, gap: 16, padding: 20, paddingBottom: 48, paddingTop: 28 }, eyebrow: { color: theme.colors.coralDark, fontSize: 12, fontWeight: '800', letterSpacing: 1.4 }, title: { color: theme.colors.primary, fontFamily: 'Georgia', fontSize: 36, fontWeight: '700', lineHeight: 44 }, error: { color: theme.colors.error, fontSize: 17, textAlign: 'center' } });
