import { useCallback, useRef, useState } from 'react';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { StyleSheet, Text } from 'react-native';
import { ToyForm } from '@/components/toy-form';
import { ToyError, ToyLoading } from '@/components/toy-ui';
import { ParentModeHeader } from '@/components/parent-ui';
import { Card, PageShell, PrimaryButton, QuietButton } from '@/components/playmap-ui';
import { initializeDatabase } from '@/database/client';
import { loadLocationTree, type LocationTreeItem } from '@/features/locations/location-service';
import { createParentToy, type ToyFormInput } from '@/features/toys/toy-service';
import { saveIntakeQueue } from '@/features/toys/toy-intake-queue';
import type { ToySetupDraft } from '@/domain/models';
import { playmapTheme as theme } from '@/theme/playmap-theme';
import { parentBackTargets } from '@/features/navigation/parent-navigation';

export default function AddToyRoute() {
  const { mode } = useLocalSearchParams<{ mode?: string }>();
  const startInBulkMode = mode === 'bulk';
  const [locations, setLocations] = useState<LocationTreeItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const submitting = useRef(false);
  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try { const database = await initializeDatabase(); setLocations(await loadLocationTree(database)); } catch (caught: unknown) { setError(caught instanceof Error ? caught.message : 'Could not load locations.'); } finally { setLoading(false); }
  }, []);
  useFocusEffect(useCallback(() => { void load(); }, [load]));
  const submit = async (input: ToyFormInput): Promise<void> => {
    if (submitting.current) return;
    submitting.current = true;
    setSaving(true); setError(null);
    try { const database = await initializeDatabase(); await createParentToy(database, input); router.replace('/parent/toy-library'); } catch (caught: unknown) { setError(caught instanceof Error ? caught.message : 'Could not save toy.'); } finally { submitting.current = false; setSaving(false); }
  };
  const submitBulk = async (drafts: readonly ToySetupDraft[]): Promise<ToySetupDraft[]> => {
    if (submitting.current) return [...drafts];
    submitting.current = true; setSaving(true); setError(null);
    try { const database = await initializeDatabase(); return await saveIntakeQueue(database, drafts); }
    catch (caught: unknown) { setError(caught instanceof Error ? caught.message : 'Could not save these toys.'); return [...drafts]; }
    finally { submitting.current = false; setSaving(false); }
  };
  if (loading) return <ToyLoading />;
  if (error && locations.length === 0) return <ToyError message={error} onRetry={() => { void load(); }} />;
  if (locations.every((room) => room.storageSpots.length === 0)) return <PageShell><ParentModeHeader backLabel="Toy Library" backTo={parentBackTargets.addToy} subtitle="Every toy needs a room and storage spot first." title="Add Toys" /><Card><Text style={styles.emptyText}>Add a room and at least one storage spot, then come back to add toys.</Text><PrimaryButton label="Add a Location" onPress={() => router.push('/parent/add-location')} /><QuietButton label="Return to Toy Library" onPress={() => router.replace('/parent/toy-library')} /></Card></PageShell>;
  return <PageShell><ParentModeHeader backLabel="Toy Library" backTo={parentBackTargets.addToy} subtitle={startInBulkMode ? 'Choose several photos and confirm one separate toy record for each.' : 'Add one toy manually or prepare a photo batch.'} title={startInBulkMode ? 'Add More Photos' : 'Add Toys'} /><ToyForm error={error} locations={locations} onBulkSubmit={submitBulk} onSubmit={submit} saving={saving} startInBulkMode={startInBulkMode} submitLabel="Save Toy" /></PageShell>;
}

const styles = StyleSheet.create({ emptyText: { color: theme.colors.secondaryText, fontSize: 17, textAlign: 'center' } });
