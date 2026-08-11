import { useCallback, useRef, useState } from 'react';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { ToyForm } from '@/components/toy-form';
import { ToyLoading } from '@/components/toy-ui';
import { ParentModeHeader } from '@/components/parent-ui';
import { BackNavigation, ErrorStateCard, PageShell, PrimaryButton } from '@/components/playmap-ui';
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
  const submitting = useRef(false);
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
    if (submitting.current) return;
    submitting.current = true;
    setSaving(true); setError(null);
    try { const database = await initializeDatabase(); await updateParentToy(database, toyId, input); router.replace(`/parent/toy-detail?id=${toyId}`); } catch (caught: unknown) { setError(caught instanceof Error ? caught.message : 'Could not save toy.'); } finally { submitting.current = false; setSaving(false); }
  };
  const errorScreen = (message: string, retry = false) => <PageShell><BackNavigation label="Back" onPress={() => router.replace('/parent/toy-library')} /><ParentModeHeader subtitle="Change the details. Play history is kept." title="Edit toy" /><ErrorStateCard action={<PrimaryButton label={retry ? 'Try again' : 'Back to the library'} onPress={() => { if (retry) void load(); else router.replace('/parent/toy-library'); }} />} message={message} /></PageShell>;
  if (!Number.isInteger(toyId) || toyId < 1) return errorScreen('This toy link is invalid.');
  if (loading) return <ToyLoading />;
  if (error && !toy) return errorScreen(error, error !== 'Toy not found.');
  if (!toy) return errorScreen('Toy not found.');
  return <PageShell><BackNavigation label={toy.name} onPress={() => router.replace(`/parent/toy-detail?id=${toyId}`)} /><ParentModeHeader subtitle={`Change ${toy.name} without changing its play history.`} title="Edit toy" /><ToyForm error={error} locations={locations} onSubmit={submit} saving={saving} submitLabel="Save changes" toy={toy} /></PageShell>;
}
