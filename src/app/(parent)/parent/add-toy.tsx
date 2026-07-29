import { useCallback, useState } from 'react';
import { router, useFocusEffect } from 'expo-router';
import { SafeAreaView, StyleSheet, Text } from 'react-native';
import { ToyForm } from '@/components/toy-form';
import { ToyError, ToyLoading } from '@/components/toy-ui';
import { initializeDatabase } from '@/database/client';
import { loadLocationTree, type LocationTreeItem } from '@/features/locations/location-service';
import { createParentToy, type ToyFormInput } from '@/features/toys/toy-service';
import { playmapTheme as theme } from '@/theme/playmap-theme';

export default function AddToyRoute() {
  const [locations, setLocations] = useState<LocationTreeItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try { const database = await initializeDatabase(); setLocations(await loadLocationTree(database)); } catch (caught: unknown) { setError(caught instanceof Error ? caught.message : 'Could not load locations.'); } finally { setLoading(false); }
  }, []);
  useFocusEffect(useCallback(() => { void load(); }, [load]));
  const submit = async (input: ToyFormInput): Promise<void> => {
    if (saving) return;
    setSaving(true); setError(null);
    try { const database = await initializeDatabase(); await createParentToy(database, input); router.replace('/parent/toy-library'); } catch (caught: unknown) { setError(caught instanceof Error ? caught.message : 'Could not save toy.'); setSaving(false); }
  };
  if (loading) return <ToyLoading />;
  if (error && locations.length === 0) return <ToyError message={error} onRetry={() => { void load(); }} />;
  if (locations.every((room) => room.storageSpots.length === 0)) return <SafeAreaView style={styles.center}><Text style={styles.emptyText}>Add a room and storage spot before saving toys.</Text></SafeAreaView>;
  return <SafeAreaView style={styles.container}><Text accessibilityRole="header" style={styles.title}>Add Toy</Text><ToyForm error={error} locations={locations} onSubmit={submit} saving={saving} submitLabel="Save Toy" /></SafeAreaView>;
}

const styles = StyleSheet.create({ center: { alignItems: 'center', backgroundColor: theme.colors.background, flex: 1, justifyContent: 'center', padding: 24 }, container: { backgroundColor: theme.colors.background, flex: 1 }, emptyText: { color: theme.colors.secondaryText, fontSize: 17, textAlign: 'center' }, title: { color: theme.colors.primary, fontFamily: 'Georgia', fontSize: theme.type.title, fontWeight: '700', paddingHorizontal: 24, paddingTop: 32 } });
