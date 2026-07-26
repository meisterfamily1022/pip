import { useCallback, useState } from 'react';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { SafeAreaView, StyleSheet, Text } from 'react-native';
import { ToyForm } from '@/components/toy-form';
import { ToyError, ToyLoading } from '@/components/toy-ui';
import { initializeDatabase } from '@/database/client';
import { loadLocationTree, type LocationTreeItem } from '@/features/locations/location-service';
import { updateParentToy, type ToyFormInput } from '@/features/toys/toy-service';
import { getParentToy, type ParentToy } from '@/repositories/toys-repository';

export default function EditToyRoute() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const toyId = Number(id);
  const [toy, setToy] = useState<ParentToy | null>(null);
  const [locations, setLocations] = useState<LocationTreeItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const database = await initializeDatabase();
      const [nextToy, nextLocations] = await Promise.all([getParentToy(database, toyId), loadLocationTree(database)]);
      if (!nextToy) throw new Error('Toy not found.');
      setToy(nextToy); setLocations(nextLocations);
    } catch (caught: unknown) {
      setError(caught instanceof Error ? caught.message : 'Could not load toy.');
    } finally {
      setLoading(false);
    }
  }, [toyId]);
  useFocusEffect(useCallback(() => { void load(); }, [load]));
  const submit = async (input: ToyFormInput): Promise<void> => {
    if (saving) return;
    setSaving(true); setError(null);
    try { const database = await initializeDatabase(); await updateParentToy(database, toyId, input); router.replace('/parent/toy-library'); } catch (caught: unknown) { setError(caught instanceof Error ? caught.message : 'Could not save toy.'); setSaving(false); }
  };
  if (loading) return <ToyLoading />;
  if (error && !toy) return <ToyError message={error} onRetry={() => { void load(); }} />;
  if (!toy) return <ToyError message="Toy not found." onRetry={() => router.replace('/parent/toy-library')} />;
  return <SafeAreaView style={styles.container}><Text accessibilityRole="header" style={styles.title}>Edit Toy</Text><ToyForm error={error} locations={locations} onSubmit={submit} saving={saving} submitLabel="Save Changes" toy={toy} /></SafeAreaView>;
}

const styles = StyleSheet.create({ container: { flex: 1 }, title: { fontSize: 32, fontWeight: '700', paddingHorizontal: 24, paddingTop: 56 } });
