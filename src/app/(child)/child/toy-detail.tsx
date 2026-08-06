import { useEffect, useState } from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import { ActivityIndicator, StyleSheet, Text } from 'react-native';
import { ChildButton, ChildModeHeader, LocationPanel, ToyImage } from '@/components/child-ui';
import { PageHeader, PageShell } from '@/components/playmap-ui';
import { playmapTheme as theme } from '@/theme/playmap-theme';
import { initializeDatabase } from '@/database/client';
import { getActivePlaySession, startPlaySessionIfNoneActive } from '@/repositories/play-sessions-repository';
import { listChildToys, type ChildToy } from '@/repositories/toys-repository';
import { getSettings } from '@/repositories/settings-repository';
import { getActiveChildProfile } from '@/repositories/child-profiles-repository';

export default function ChildToyDetailRoute() {
  const { id, category: categoryParam, surprise: surpriseParam } = useLocalSearchParams<{ id?: string; category?: string; surprise?: string }>(); const toyId = Number(id); const invalidToyId = !Number.isInteger(toyId) || toyId < 1; const [toy, setToy] = useState<ChildToy | null>(null); const [loading, setLoading] = useState(true); const [error, setError] = useState<string | null>(null); const [saving, setSaving] = useState(false);
  useEffect(() => { if (invalidToyId) return; initializeDatabase().then(async (database) => listChildToys(database, { childId: (await getSettings(database)).activeChildId })).then((toys) => { const foundToy = toys.find((candidate) => candidate.id === toyId) ?? null; setToy(foundToy); if (!foundToy) setError('This toy is not available.'); }).catch((caught: unknown) => setError(caught instanceof Error ? caught.message : 'Could not load this toy.')).finally(() => setLoading(false)); }, [invalidToyId, toyId]);
  const found = async (): Promise<void> => { if (!toy || saving) return; setSaving(true); setError(null); try { const db = await initializeDatabase(); const child = await getActiveChildProfile(db); const active = await getActivePlaySession(db, child.id); if (active) { router.replace('/child/current-toy'); return; } await startPlaySessionIfNoneActive(db, child.id, toy.id); router.replace('/child/current-toy'); } catch (caught: unknown) { setError(caught instanceof Error ? caught.message : 'Could not start play.'); setSaving(false); } };
  const returnToIdeas = (): void => router.replace({ pathname: '/child/toy-suggestions', params: { category: categoryParam ?? 'anything', ...(surpriseParam === '1' ? { surprise: '1' } : {}) } });
  if (invalidToyId) return <PageShell child><ChildModeHeader backLabel="Toy ideas" onBack={returnToIdeas} /><PageHeader eyebrow="TOY IDEAS" subtitle="Choose another toy to keep playing." title="Toy Not Available" /><Text style={styles.error}>This toy link is invalid.</Text></PageShell>;
  if (loading) return <PageShell child scroll={false}><ChildModeHeader backLabel="Toy ideas" onBack={returnToIdeas} /><ActivityIndicator color={theme.colors.sageAction} /><Text style={styles.loading}>Loading toy…</Text></PageShell>;
  if (error || !toy) return <PageShell child><ChildModeHeader backLabel="Toy ideas" onBack={returnToIdeas} /><PageHeader eyebrow="TOY IDEAS" subtitle="Choose another toy to keep playing." title="Toy Not Available" /><Text style={styles.error}>{error ?? 'This toy is not available.'}</Text></PageShell>;
  return <PageShell child><ChildModeHeader backLabel="Toy ideas" onBack={returnToIdeas} /><Text style={styles.eyebrow}>YOU FOUND A TOY</Text><ToyImage uri={toy.imageUri} /><Text accessibilityRole="header" style={styles.title}>{toy.name}</Text><LocationPanel room={toy.roomName} spot={toy.storageSpotName} /><ChildButton label={saving ? 'Starting…' : 'I Found It'} disabled={saving} onPress={() => void found()} /></PageShell>;
}
const styles = StyleSheet.create({ eyebrow: { color: theme.colors.coralDark, fontSize: 12, fontWeight: '800', letterSpacing: 1.4 }, title: { color: theme.colors.primaryText, fontFamily: 'Georgia', fontSize: 36, fontWeight: '700', lineHeight: 44 }, error: { color: theme.colors.error, fontSize: 17, textAlign: 'center' }, loading: { color: theme.colors.secondaryText, fontSize: 17, textAlign: 'center' } });
