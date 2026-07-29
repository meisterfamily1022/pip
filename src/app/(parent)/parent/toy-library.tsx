import { useCallback, useState } from 'react';
import { router, useFocusEffect } from 'expo-router';
import { Alert, Platform, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { ToyButton, ToyError, ToyGridCard, ToyLoading } from '@/components/toy-ui';
import { initializeDatabase } from '@/database/client';
import { PLAY_CATEGORIES, type PlayCategory } from '@/domain/play-category';
import { loadLocationTree, type LocationTreeItem } from '@/features/locations/location-service';
import { archiveParentToy, permanentlyDeleteParentToy, restoreParentToy, setParentToyAvailability } from '@/features/toys/toy-service';
import { listParentToys, type ParentToy, type ToyFilters } from '@/repositories/toys-repository';
import { playmapTheme as theme, screenContentStyle } from '@/theme/playmap-theme';

const categoryLabels: Record<PlayCategory, string> = { quiet: 'Quiet', active: 'Active', creative: 'Creative', building: 'Building', pretend: 'Pretend', sensory: 'Sensory', independent: 'Independent', together: 'Play Together', indoor: 'Indoor', outdoor: 'Outdoor' };

async function confirmAction(title: string, message: string): Promise<boolean> {
  if (Platform.OS === 'web') return globalThis.confirm(`${title}\n\n${message}`);
  return new Promise((resolve) => {
    Alert.alert(title, message, [{ text: 'Cancel', style: 'cancel', onPress: () => resolve(false) }, { text: 'Continue', style: 'destructive', onPress: () => resolve(true) }]);
  });
}

export default function ParentToyLibraryRoute() {
  const [toys, setToys] = useState<ParentToy[]>([]);
  const [locations, setLocations] = useState<LocationTreeItem[]>([]);
  const [filters, setFilters] = useState<ToyFilters>({ archived: 'active', availability: 'all' });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const database = await initializeDatabase();
      const [nextToys, nextLocations] = await Promise.all([listParentToys(database, filters), loadLocationTree(database)]);
      setToys(nextToys); setLocations(nextLocations);
    } catch (caught: unknown) {
      setError(caught instanceof Error ? caught.message : 'Could not load the toy library.');
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useFocusEffect(useCallback(() => { void reload(); }, [reload]));

  const mutate = async (task: () => Promise<void>): Promise<void> => {
    try { await task.call(null); await reload(); } catch (caught: unknown) { setError(caught instanceof Error ? caught.message : 'Toy action failed.'); }
  };

  const archiveToy = async (toy: ParentToy): Promise<void> => {
    if (!await confirmAction('Archive toy?', `${toy.name} will stay saved but will not appear in Child Mode.`)) return;
    const database = await initializeDatabase();
    await archiveParentToy(database, toy.id);
    await reload();
  };

  const restoreToy = async (toy: ParentToy): Promise<void> => {
    await mutate(async () => { const database = await initializeDatabase(); await restoreParentToy(database, toy.id); });
  };

  const deleteToy = async (toy: ParentToy): Promise<void> => {
    if (!await confirmAction('Permanently delete toy?', `${toy.name} and its managed photo will be removed from PlayMap.`)) return;
    const database = await initializeDatabase();
    try { await permanentlyDeleteParentToy(database, toy.id); await reload(); } catch (caught: unknown) { setError(caught instanceof Error ? caught.message : 'Could not delete toy.'); }
  };

  if (loading) return <ToyLoading />;
  if (error && toys.length === 0) return <ToyError message={error} onRetry={() => { void reload(); }} />;

  return (
    <ScrollView contentInsetAdjustmentBehavior="automatic" contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <View style={styles.headerText}>
          <Text accessibilityRole="header" style={styles.title}>Toy Library</Text>
          <Text style={styles.helper}>Photograph toys, assign where they live, and decide what Child Mode can offer.</Text>
        </View>
        <ToyButton label="Add Toy" onPress={() => router.push('/parent/add-toy')} />
      </View>
      {error && <Text accessibilityLiveRegion="polite" style={styles.error}>{error}</Text>}
      <TextInput accessibilityLabel="Search toys" onChangeText={(search) => setFilters((current) => ({ ...current, search }))} placeholder="Search toys" style={styles.search} value={filters.search ?? ''} />
      <View style={styles.filters}>
        <ToyButton label="All Rooms" onPress={() => setFilters((current) => ({ ...current, roomId: null }))} />
        {locations.map((room) => <ToyButton key={room.id} label={room.name} selected={filters.roomId === room.id} onPress={() => setFilters((current) => ({ ...current, roomId: room.id }))} />)}
      </View>
      <View style={styles.filters}>
        <ToyButton label="All Categories" onPress={() => setFilters((current) => ({ ...current, category: null }))} />
        {PLAY_CATEGORIES.map((category) => <ToyButton key={category} label={categoryLabels[category]} selected={filters.category === category} onPress={() => setFilters((current) => ({ ...current, category }))} />)}
      </View>
      <View style={styles.filters}>
        {(['all', 'available', 'hidden'] as const).map((availability) => <ToyButton key={availability} label={availability === 'all' ? 'Available + Hidden' : availability} selected={filters.availability === availability} onPress={() => setFilters((current) => ({ ...current, availability }))} />)}
        {(['active', 'archived', 'all'] as const).map((archived) => <ToyButton key={archived} label={archived === 'active' ? 'Not Archived' : archived} selected={filters.archived === archived} onPress={() => setFilters((current) => ({ ...current, archived }))} />)}
      </View>
      {toys.length === 0 ? <Text style={styles.empty}>No toys match these filters yet.</Text> : <View style={styles.grid}>{toys.map((toy) => (
        <View key={toy.id} style={styles.tile}>
          <ToyGridCard toy={toy} onPress={() => router.push(`/parent/edit-toy?id=${toy.id}`)} />
          <View style={styles.cardActions}>
            <ToyButton label="Edit" onPress={() => router.push(`/parent/edit-toy?id=${toy.id}`)} />
            <ToyButton label={toy.isAvailable ? 'Hide' : 'Show'} onPress={() => { void mutate(async () => { const database = await initializeDatabase(); await setParentToyAvailability(database, toy.id, !toy.isAvailable); }); }} />
            <ToyButton label={toy.isArchived ? 'Restore' : 'Archive'} onPress={() => { void (toy.isArchived ? restoreToy(toy) : archiveToy(toy)); }} />
            <ToyButton label="Delete" destructive onPress={() => { void deleteToy(toy); }} />
          </View>
        </View>
      ))}</View>}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  cardActions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingTop: 8 },
  content: { ...screenContentStyle, backgroundColor: theme.colors.background, flexGrow: 1, gap: 16 },
  empty: { color: theme.colors.mutedText, fontSize: 17 },
  error: { color: theme.colors.danger },
  filters: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 14 },
  header: { gap: 14 },
  headerText: { gap: 8 },
  helper: { color: theme.colors.mutedText, fontSize: 17, lineHeight: 25 },
  search: { backgroundColor: theme.colors.surface, borderColor: theme.colors.border, borderRadius: theme.radii.pill, borderWidth: 1, color: theme.colors.text, fontSize: 17, minHeight: 52, paddingHorizontal: 18 },
  tile: { flexBasis: '47%', flexGrow: 1, minWidth: 160 },
  title: { color: theme.colors.primary, fontFamily: 'Georgia', fontSize: 32, fontWeight: '700' },
});
