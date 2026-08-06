import { useCallback, useState } from 'react';
import { router, useFocusEffect } from 'expo-router';
import { Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, useWindowDimensions, View } from 'react-native';

import { ParentModeHeader } from '@/components/parent-ui';
import { Card, ConfirmationDialog, EmptyStateCard, FilterChip, ImageTile, PageShell, PrimaryButton, QuietButton, SecondaryButton } from '@/components/playmap-ui';
import { ToyError, ToyLoading } from '@/components/toy-ui';
import { initializeDatabase } from '@/database/client';
import { PLAY_CATEGORIES, type PlayCategory } from '@/domain/play-category';
import { loadLocationTree, type LocationTreeItem } from '@/features/locations/location-service';
import { BULK_TOY_INTAKE_ROUTE, parentBackTargets } from '@/features/navigation/parent-navigation';
import { countActiveToyFilters, DEFAULT_TOY_FILTERS, resetToyFilters, toyFilterLabels } from '@/features/toys/toy-filter-state';
import { archiveParentToy, getToyDeletionImpact, permanentlyDeleteParentToy, restoreParentToy, setParentToyAvailability } from '@/features/toys/toy-service';
import { listParentToys, type ParentToy, type ToyFilters } from '@/repositories/toys-repository';
import { playmapTheme as theme } from '@/theme/playmap-theme';

const labels: Record<PlayCategory, string> = { quiet: 'Quiet', active: 'Active', creative: 'Creative', building: 'Building', pretend: 'Pretend', sensory: 'Sensory', independent: 'Independent', together: 'Together', indoor: 'Indoor', outdoor: 'Outdoor' };

export default function ParentToyLibraryRoute() {
  const [toys, setToys] = useState<ParentToy[]>([]);
  const [total, setTotal] = useState(0);
  const [locations, setLocations] = useState<LocationTreeItem[]>([]);
  const [filters, setFilters] = useState<ToyFilters>({ ...DEFAULT_TOY_FILTERS });
  const [draftFilters, setDraftFilters] = useState<ToyFilters>({ ...DEFAULT_TOY_FILTERS });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterOpen, setFilterOpen] = useState(false);
  const [pendingHide, setPendingHide] = useState<ParentToy | null>(null);
  const [pendingArchive, setPendingArchive] = useState<ParentToy | null>(null);
  const [pendingToyDeletion, setPendingToyDeletion] = useState<{ id: number; message: string; name: string } | null>(null);
  const { width } = useWindowDimensions();
  const contentWidth = Math.min(width - (theme.measurements.screenHorizontalPadding * 2), theme.measurements.pageMaxWidth);
  const columns = contentWidth >= 840 ? 3 : contentWidth >= 520 ? 2 : 1;
  const activeFilterCount = countActiveToyFilters(filters);
  const activeLabels = toyFilterLabels(filters, locations);

  const reload = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const db = await initializeDatabase();
      const [visible, all, tree] = await Promise.all([listParentToys(db, filters), listParentToys(db, { archived: 'all' }), loadLocationTree(db)]);
      setToys(visible); setTotal(all.length); setLocations(tree);
    } catch (caught: unknown) {
      setError(caught instanceof Error ? caught.message : 'Could not load the toy library.');
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useFocusEffect(useCallback(() => { void reload(); }, [reload]));

  const openFilters = (): void => { setDraftFilters({ ...filters }); setFilterOpen(true); };
  const clearFilters = (): void => {
    const reset = resetToyFilters();
    setFilters(reset); setDraftFilters(reset); setFilterOpen(false);
  };
  const update = async (task: () => Promise<void>): Promise<void> => {
    try { await task(); await reload(); } catch (caught: unknown) { setError(caught instanceof Error ? caught.message : 'Toy action failed.'); }
  };
  const prepareToyDeletion = async (toy: ParentToy): Promise<void> => {
    setError(null);
    try {
      const db = await initializeDatabase();
      const impact = await getToyDeletionImpact(db, toy.id);
      setPendingToyDeletion({ id: toy.id, message: impact.message, name: toy.name });
    } catch (caught: unknown) {
      setError(caught instanceof Error ? caught.message : 'Could not prepare toy deletion.');
    }
  };
  const confirmToyDeletion = async (): Promise<void> => {
    const request = pendingToyDeletion;
    if (!request) return;
    setPendingToyDeletion(null);
    await update(async () => {
      const db = await initializeDatabase();
      await permanentlyDeleteParentToy(db, request.id);
    });
  };
  const confirmArchiveChange = async (): Promise<void> => {
    const toy = pendingArchive;
    if (!toy) return;
    setPendingArchive(null);
    await update(async () => {
      const db = await initializeDatabase();
      if (toy.isArchived) await restoreParentToy(db, toy.id);
      else await archiveParentToy(db, toy.id);
    });
  };
  const confirmHide = async (): Promise<void> => {
    const toy = pendingHide;
    if (!toy) return;
    setPendingHide(null);
    await update(async () => {
      const db = await initializeDatabase();
      await setParentToyAvailability(db, toy.id, false);
    });
  };
  const emptyCopy = activeFilterCount > 0
    ? { title: 'No toys match these filters', message: 'Reset filters or choose a different combination.' }
    : { title: 'Your toy library is ready', message: 'Add a first batch of photos, then give each toy a home.' };

  if (loading) return <ToyLoading />;
  if (error && !toys.length) return <ToyError message={error} onRetry={() => void reload()} />;

  return <PageShell>
    <ParentModeHeader action={<PrimaryButton label="Add Toys" onPress={() => router.push('/parent/add-toy')} />} backLabel="Home" backTo={parentBackTargets.toyLibrary} subtitle={`${toys.length} of ${total} ${total === 1 ? 'toy' : 'toys'} showing`} title="Toy Library" />
    {error && <Text accessibilityLiveRegion="polite" style={styles.error}>{error}</Text>}
    <View style={styles.tools}>
      <TextInput accessibilityLabel="Search toys" onChangeText={(search) => setFilters((current) => ({ ...current, search: search || undefined }))} placeholder="Search toys" placeholderTextColor={theme.colors.mutedText} style={styles.search} value={filters.search ?? ''} />
      <SecondaryButton label={activeFilterCount ? `Filters (${activeFilterCount})` : 'Filters'} onPress={openFilters} />
    </View>
    {activeLabels.length > 0 && <View accessibilityLabel={`${activeFilterCount} active filters`} style={styles.activeFilters}>
      <View style={styles.activeHeading}><Text style={styles.sheetLabel}>Active filters</Text><QuietButton label="Reset Filters" onPress={clearFilters} /></View>
      <View style={styles.chips}>{activeLabels.map((label) => <FilterChip key={label} label={label} selected onPress={openFilters} />)}</View>
    </View>}
    <View style={styles.subActions}><QuietButton label="Add More Photos" onPress={() => router.push(BULK_TOY_INTAKE_ROUTE)} /><Text style={styles.resultText}>{toys.length} showing</Text></View>
    {toys.length === 0
      ? <EmptyStateCard {...emptyCopy} action={activeFilterCount > 0 ? <PrimaryButton label="Reset Filters" onPress={clearFilters} /> : <PrimaryButton label="Add Toys" onPress={() => router.push('/parent/add-toy')} />} />
      : <View style={styles.grid}>{toys.map((toy) => <View key={toy.id} style={{ width: `${100 / columns}%`, padding: 5 }}><LibraryCard toy={toy} onEdit={() => router.push(`/parent/edit-toy?id=${toy.id}`)} onToggle={() => { if (toy.isAvailable) setPendingHide(toy); else void update(async () => { const db = await initializeDatabase(); await setParentToyAvailability(db, toy.id, true); }); }} onArchive={() => setPendingArchive(toy)} onDelete={() => { void prepareToyDeletion(toy); }} /></View>)}</View>}
    <FilterSheet filters={draftFilters} locations={locations} onApply={() => { setFilters({ ...draftFilters }); setFilterOpen(false); }} onChange={setDraftFilters} onClose={() => setFilterOpen(false)} onReset={clearFilters} visible={filterOpen} />
    <ConfirmationDialog confirmLabel="Hide Toy" message={pendingHide ? `${pendingHide.name} will stay saved but will no longer appear in Child Mode. You can show it again at any time.` : ''} onCancel={() => setPendingHide(null)} onConfirm={() => { void confirmHide(); }} title={pendingHide ? `Hide ${pendingHide.name}?` : 'Hide Toy?'} visible={pendingHide !== null} />
    <ConfirmationDialog confirmLabel={pendingArchive?.isArchived ? 'Restore Toy' : 'Archive Toy'} message={pendingArchive ? pendingArchive.isArchived ? `${pendingArchive.name} will return to the active library and can appear in Child Mode.` : `${pendingArchive.name} will stay saved but will be removed from Child Mode. You can restore it later.` : ''} onCancel={() => setPendingArchive(null)} onConfirm={() => { void confirmArchiveChange(); }} title={pendingArchive?.isArchived ? 'Restore Toy?' : 'Archive Toy?'} visible={pendingArchive !== null} />
    <ConfirmationDialog confirmLabel="Delete Toy" destructive message={pendingToyDeletion?.message ?? ''} onCancel={() => setPendingToyDeletion(null)} onConfirm={() => { void confirmToyDeletion(); }} title={pendingToyDeletion ? `Delete ${pendingToyDeletion.name}?` : 'Delete Toy?'} visible={pendingToyDeletion !== null} />
  </PageShell>;
}

function LibraryCard({ toy, onEdit, onToggle, onArchive, onDelete }: { toy: ParentToy; onEdit(): void; onToggle(): void; onArchive(): void; onDelete(): void }) {
  return <Card style={styles.toyCard}><View style={styles.cardTop}><ImageTile label={toy.name} size={86} uri={toy.imageUri} /><View style={styles.cardCopy}><Text numberOfLines={2} style={styles.name}>{toy.name}</Text><Text numberOfLines={1} style={styles.place}>{toy.roomName}</Text><Text numberOfLines={1} style={styles.place}>{toy.storageSpotName}</Text></View></View>{!toy.imageUri && <QuietButton label="Add photo" onPress={onEdit} />}<View style={styles.meta}>{toy.categories.slice(0, 2).map((category) => <Text key={category} style={styles.metaText}>{labels[category]}</Text>)}{!toy.isAvailable && <Text style={styles.metaText}>Hidden</Text>}{toy.isArchived && <Text style={styles.metaText}>Archived</Text>}</View><View style={styles.actions}><QuietButton label="Edit" onPress={onEdit} style={styles.cardAction} /><QuietButton label={toy.isAvailable ? 'Hide' : 'Show'} onPress={onToggle} style={styles.cardAction} /><QuietButton label={toy.isArchived ? 'Restore' : 'Archive'} onPress={onArchive} style={styles.cardAction} /><QuietButton label="Delete" onPress={onDelete} style={styles.cardAction} /></View></Card>;
}

function FilterSheet({ visible, onClose, filters, onChange, onApply, onReset, locations }: { visible: boolean; onClose(): void; filters: ToyFilters; onChange(value: ToyFilters): void; onApply(): void; onReset(): void; locations: LocationTreeItem[] }) {
  const storageSpots = filters.roomId ? locations.find((room) => room.id === filters.roomId)?.storageSpots ?? [] : locations.flatMap((room) => room.storageSpots);
  const chooseRoom = (roomId: number | null): void => {
    const selectedSpotStillMatches = !filters.storageSpotId || roomId === null || locations.find((room) => room.id === roomId)?.storageSpots.some((spot) => spot.id === filters.storageSpotId);
    onChange({ ...filters, roomId, storageSpotId: selectedSpotStillMatches ? filters.storageSpotId : null });
  };
  return <Modal animationType="slide" onRequestClose={onClose} transparent visible={visible}><View style={styles.modalRoot}><Pressable accessibilityLabel="Close filters" accessibilityRole="button" onPress={onClose} style={styles.backdrop} /><View style={styles.sheet}><ScrollView contentContainerStyle={styles.sheetContent} keyboardShouldPersistTaps="handled">
    <View style={styles.activeHeading}><Text accessibilityRole="header" style={styles.sheetTitle}>Filter toys</Text><QuietButton label="Close" onPress={onClose} /></View>
    <Text style={styles.sheetLabel}>Room</Text><View style={styles.chips}><FilterChip label="All rooms" selected={!filters.roomId} onPress={() => chooseRoom(null)} />{locations.map((room) => <FilterChip key={room.id} label={room.name} selected={filters.roomId === room.id} onPress={() => chooseRoom(room.id)} />)}</View>
    <Text style={styles.sheetLabel}>Storage spot</Text><View style={styles.chips}><FilterChip label="All storage spots" selected={!filters.storageSpotId} onPress={() => onChange({ ...filters, storageSpotId: null })} />{storageSpots.map((spot) => <FilterChip key={spot.id} label={spot.name} selected={filters.storageSpotId === spot.id} onPress={() => onChange({ ...filters, roomId: spot.roomId, storageSpotId: spot.id })} />)}</View>
    <Text style={styles.sheetLabel}>Category</Text><View style={styles.chips}><FilterChip label="All categories" selected={!filters.category} onPress={() => onChange({ ...filters, category: null })} />{PLAY_CATEGORIES.map((category) => <FilterChip key={category} label={labels[category]} selected={filters.category === category} onPress={() => onChange({ ...filters, category })} />)}</View>
    <Text style={styles.sheetLabel}>Cleanup size</Text><View style={styles.chips}><FilterChip label="Any cleanup" selected={!filters.cleanupDifficulty} onPress={() => onChange({ ...filters, cleanupDifficulty: null })} />{(['easy', 'medium', 'big'] as const).map((value) => <FilterChip key={value} label={value === 'big' ? 'Big' : `${value[0].toUpperCase()}${value.slice(1)}`} selected={filters.cleanupDifficulty === value} onPress={() => onChange({ ...filters, cleanupDifficulty: value })} />)}</View>
    <Text style={styles.sheetLabel}>Adult help</Text><View style={styles.chips}><FilterChip label="Any" selected={filters.adultHelpRequired == null} onPress={() => onChange({ ...filters, adultHelpRequired: null })} /><FilterChip label="Required" selected={filters.adultHelpRequired === true} onPress={() => onChange({ ...filters, adultHelpRequired: true })} /><FilterChip label="Not required" selected={filters.adultHelpRequired === false} onPress={() => onChange({ ...filters, adultHelpRequired: false })} /></View>
    <Text style={styles.sheetLabel}>Child visibility</Text><View style={styles.chips}>{(['all', 'available', 'hidden'] as const).map((value) => <FilterChip key={value} label={value === 'all' ? 'All' : value === 'available' ? 'Visible to child' : 'Hidden from child'} selected={filters.availability === value} onPress={() => onChange({ ...filters, availability: value })} />)}</View>
    <Text style={styles.sheetLabel}>Library status</Text><View style={styles.chips}>{(['active', 'archived', 'all'] as const).map((value) => <FilterChip key={value} label={value === 'active' ? 'Active' : value === 'archived' ? 'Archived' : 'Active + archived'} selected={filters.archived === value} onPress={() => onChange({ ...filters, archived: value })} />)}</View>
    <View style={styles.sheetActions}><QuietButton label="Reset Filters" onPress={onReset} /><PrimaryButton label="Apply Filters" onPress={onApply} /></View>
  </ScrollView></View></View></Modal>;
}

const styles = StyleSheet.create({
  error: { color: theme.colors.error },
  tools: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  search: { backgroundColor: theme.colors.surface, borderColor: theme.colors.border, borderRadius: theme.radii.pill, borderWidth: 1, color: theme.colors.primaryText, flex: 1, fontSize: 16, minHeight: 48, minWidth: 220, paddingHorizontal: 16 },
  activeFilters: { backgroundColor: theme.colors.surfaceSage, borderRadius: theme.radii.medium, gap: 8, padding: 12 },
  activeHeading: { alignItems: 'center', flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  subActions: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  resultText: { color: theme.colors.secondaryText, fontSize: 14 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: -5 },
  toyCard: { minHeight: 210, padding: 14 },
  cardTop: { flexDirection: 'row', gap: 12 },
  cardCopy: { flex: 1, gap: 3 },
  name: { color: theme.colors.primaryText, fontFamily: 'Georgia', fontSize: 18, fontWeight: '700', lineHeight: 22 },
  place: { color: theme.colors.secondaryText, fontSize: 13 },
  meta: { flexDirection: 'row', flexWrap: 'wrap', gap: 5 },
  metaText: { backgroundColor: theme.colors.surfaceSage, borderRadius: 10, color: theme.colors.primaryText, fontSize: 11, fontWeight: '700', overflow: 'hidden', paddingHorizontal: 7, paddingVertical: 4 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 2 },
  cardAction: { paddingHorizontal: 8 },
  modalRoot: { flex: 1, justifyContent: 'flex-end' },
  backdrop: { backgroundColor: 'rgba(43,53,47,0.35)', bottom: 0, left: 0, position: 'absolute', right: 0, top: 0 },
  sheet: { backgroundColor: theme.colors.backgroundCream, borderTopLeftRadius: 28, borderTopRightRadius: 28, maxHeight: '88%', overflow: 'hidden' },
  sheetContent: { gap: 14, padding: 22, paddingBottom: 36 },
  sheetTitle: { color: theme.colors.primaryText, fontFamily: 'Georgia', fontSize: 25, fontWeight: '700' },
  sheetLabel: { color: theme.colors.primaryText, fontSize: 14, fontWeight: '800' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  sheetActions: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, justifyContent: 'flex-end', marginTop: 8 },
});
