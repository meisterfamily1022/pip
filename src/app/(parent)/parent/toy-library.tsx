import { useCallback, useMemo, useState } from 'react';
import { router, useFocusEffect } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';

import { ParentScreen } from '@/components/parent-ui';
import { PipIcon } from '@/components/pip-icon';
import {
  Banner,
  ConfirmationDialog,
  EmptyStateCard,
  FilterChip,
  PrimaryButton,
  QuietButton,
  SearchField,
  SecondaryButton,
  Sheet,
  SkeletonGrid,
  ToyPhotoCard,
} from '@/components/playmap-ui';
import { toyCardStatus } from '@/components/toy-ui';
import { initializeDatabase } from '@/database/client';
import { PLAY_CATEGORIES, type PlayCategory } from '@/domain/play-category';
import { loadLocationTree, type LocationTreeItem } from '@/features/locations/location-service';
import {
  countActiveToyFilters,
  DEFAULT_TOY_FILTERS,
  resetToyFilters,
  toyFilterLabels,
} from '@/features/toys/toy-filter-state';
import { getToyDeletionImpact, permanentlyDeleteParentToy, setParentToyAvailability } from '@/features/toys/toy-service';
import { listActivePlaySessions } from '@/repositories/play-sessions-repository';
import { listParentToys, type ParentToy, type ToyFilters } from '@/repositories/toys-repository';
import { playmapTheme as theme } from '@/theme/playmap-theme';

const labels: Record<PlayCategory, string> = {
  quiet: 'Quiet', active: 'Active', creative: 'Make', building: 'Build', pretend: 'Pretend',
  sensory: 'Touch & feel', independent: 'Alone', together: 'Together', indoor: 'Indoor', outdoor: 'Outdoor',
};

type LoadState = 'loading' | 'ready' | 'error';

export default function ParentToyLibraryRoute() {
  const [toys, setToys] = useState<ParentToy[]>([]);
  const [total, setTotal] = useState(0);
  const [holders, setHolders] = useState<Map<number, string>>(new Map());
  const [locations, setLocations] = useState<LocationTreeItem[]>([]);
  const [filters, setFilters] = useState<ToyFilters>({ ...DEFAULT_TOY_FILTERS });
  const [draftFilters, setDraftFilters] = useState<ToyFilters>({ ...DEFAULT_TOY_FILTERS });
  const [state, setState] = useState<LoadState>('loading');
  const [error, setError] = useState<string | null>(null);
  const [filterOpen, setFilterOpen] = useState(false);
  const [selecting, setSelecting] = useState(false);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [pendingDeletion, setPendingDeletion] = useState<{ ids: number[]; message: string; title: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const { width } = useWindowDimensions();
  const contentWidth = Math.min(width - (theme.measurements.screenHorizontalPadding * 2), theme.measurements.pageMaxWidth);
  const columns = contentWidth >= 620 ? 3 : 2;

  const activeFilterCount = countActiveToyFilters(filters);
  const activeLabels = useMemo(() => toyFilterLabels(filters, locations), [filters, locations]);
  const searching = Boolean(filters.search?.trim());

  const reload = useCallback(async () => {
    setError(null);
    try {
      const database = await initializeDatabase();
      const [visible, all, tree, sessions] = await Promise.all([
        listParentToys(database, filters),
        listParentToys(database, { archived: 'all' }),
        loadLocationTree(database),
        listActivePlaySessions(database),
      ]);
      setToys(visible);
      setTotal(all.length);
      setLocations(tree);
      setHolders(new Map(sessions.map((session) => [session.toyId, session.childName])));
      setState('ready');
    } catch (caught: unknown) {
      setError(caught instanceof Error ? caught.message : 'The library could not load. Your toys are safe on this device.');
      setState('error');
    }
  }, [filters]);

  useFocusEffect(useCallback(() => {
    void reload();
  }, [reload]));

  const clearFilters = (): void => {
    const reset = resetToyFilters();
    setFilters(reset);
    setDraftFilters(reset);
    setFilterOpen(false);
  };

  const toggleSelected = (id: number): void => {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const leaveSelection = (): void => {
    setSelecting(false);
    setSelected(new Set());
  };

  const hideSelected = async (): Promise<void> => {
    setBusy(true);
    try {
      const database = await initializeDatabase();
      for (const id of selected) await setParentToyAvailability(database, id, false);
      leaveSelection();
      await reload();
    } catch (caught: unknown) {
      setError(caught instanceof Error ? caught.message : 'Those toys could not be hidden.');
    } finally {
      setBusy(false);
    }
  };

  const prepareDeletion = async (): Promise<void> => {
    const ids = [...selected];
    if (ids.length === 0) return;
    try {
      const database = await initializeDatabase();
      const impacts = await Promise.all(ids.map((id) => getToyDeletionImpact(database, id)));
      setPendingDeletion({
        ids,
        title: ids.length === 1 ? 'Delete this toy?' : `Delete ${ids.length} toys?`,
        message: ids.length === 1
          ? impacts[0].message
          : `${ids.length} toys and their play history will be removed. This cannot be undone.`,
      });
    } catch (caught: unknown) {
      setError(caught instanceof Error ? caught.message : 'That deletion could not be prepared.');
    }
  };

  const confirmDeletion = async (): Promise<void> => {
    if (!pendingDeletion) return;
    setBusy(true);
    try {
      const database = await initializeDatabase();
      for (const id of pendingDeletion.ids) await permanentlyDeleteParentToy(database, id);
      setPendingDeletion(null);
      leaveSelection();
      await reload();
    } catch (caught: unknown) {
      setError(caught instanceof Error ? caught.message : 'Those toys could not be deleted.');
      setPendingDeletion(null);
    } finally {
      setBusy(false);
    }
  };

  return (
    <ParentScreen
      footer={selecting && selected.size > 0 ? (
        <View style={styles.bulkBar}>
          <SecondaryButton label="Hide" onPress={() => { void hideSelected(); }} style={styles.bulkButton} />
          <SecondaryButton label="Delete" onPress={() => { void prepareDeletion(); }} style={styles.bulkButton} />
        </View>
      ) : undefined}
      tab="library"
    >
      <View style={styles.headerRow}>
        <Text accessibilityRole="header" maxFontSizeMultiplier={1.3} style={styles.title}>Library</Text>
        {toys.length > 0 || selecting ? (
          <Pressable
            accessibilityLabel={selecting ? 'Done selecting' : 'Select toys'}
            accessibilityRole="button"
            hitSlop={10}
            onPress={() => (selecting ? leaveSelection() : setSelecting(true))}
            style={({ pressed }) => [styles.selectAction, pressed && styles.pressed]}
          >
            <Text maxFontSizeMultiplier={1.5} style={styles.selectLabel}>{selecting ? 'Done' : 'Select'}</Text>
          </Pressable>
        ) : null}
      </View>

      <View style={styles.tools}>
        <View style={styles.searchWrap}>
          <SearchField
            onChangeText={(search) => setFilters((current) => ({ ...current, search: search || undefined }))}
            placeholder={total > 0 ? `Search ${total} ${total === 1 ? 'toy' : 'toys'}` : 'Search toys'}
            value={filters.search ?? ''}
          />
        </View>
        <Pressable
          accessibilityHint="Narrow the library by room, spot, kind of play and more"
          accessibilityLabel={activeFilterCount > 0 ? `Filters, ${activeFilterCount} applied` : 'Filters'}
          accessibilityRole="button"
          onPress={() => {
            setDraftFilters({ ...filters });
            setFilterOpen(true);
          }}
          style={({ pressed }) => [styles.filterButton, activeFilterCount > 0 && styles.filterButtonActive, pressed && styles.pressed]}
        >
          <PipIcon color={theme.colors.brandInk} name="settings" size={20} />
          {activeFilterCount > 0 ? <Text maxFontSizeMultiplier={1.5} style={styles.filterCount}>{activeFilterCount}</Text> : null}
        </Pressable>
      </View>

      {activeLabels.length > 0 ? (
        <View style={styles.appliedRow}>
          {activeLabels.map((label) => (
            <FilterChip key={label} label={label} onRemove={clearFilters} selected />
          ))}
          <QuietButton label="Clear" onPress={clearFilters} style={styles.clearButton} />
          <Text maxFontSizeMultiplier={1.8} style={styles.shown}>{`${toys.length} shown`}</Text>
        </View>
      ) : null}

      {error ? (
        <Banner
          action={<SecondaryButton label="Retry" onPress={() => { void reload(); }} />}
          message={error}
          title="The library couldn’t load"
          tone="alert"
        />
      ) : null}

      {state === 'loading' ? (
        <SkeletonGrid label="Loading toys…" tiles={6} />
      ) : toys.length === 0 ? (
        searching || activeFilterCount > 0 ? (
          <NoResults
            onClear={clearFilters}
            search={filters.search?.trim()}
            suggestions={locations.slice(0, 3).map((room) => room.name)}
          />
        ) : (
          <EmptyStateCard
            action={<PrimaryButton label="Add toys" onPress={() => router.replace('/parent/add-toy')} />}
            icon="camera"
            message="Photograph a shelf and Pip will do the rest."
            title="No toys yet"
          />
        )
      ) : (
        <View style={styles.grid}>
          {toys.map((toy) => {
            const holder = holders.get(toy.id);
            const isSelected = selected.has(toy.id);
            return (
              <View key={toy.id} style={[styles.cell, { width: `${100 / columns}%` }]}>
                <ToyPhotoCard
                  holderName={holder}
                  location={`${toy.roomName} · ${toy.storageSpotName}`}
                  onPress={() => (selecting ? toggleSelected(toy.id) : router.push(`/parent/toy-detail?id=${toy.id}`))}
                  status={selecting && isSelected ? 'selected' : toyCardStatus(toy, holder)}
                  title={toy.name}
                  uri={toy.imageUri}
                />
              </View>
            );
          })}
        </View>
      )}

      <FilterSheet
        filters={draftFilters}
        locations={locations}
        onApply={() => {
          setFilters({ ...draftFilters });
          setFilterOpen(false);
        }}
        onChange={setDraftFilters}
        onClose={() => setFilterOpen(false)}
        onReset={clearFilters}
        visible={filterOpen}
      />

      <ConfirmationDialog
        busy={busy}
        cancelLabel="Keep"
        confirmLabel="Delete"
        destructive
        message={pendingDeletion?.message ?? ''}
        onCancel={() => setPendingDeletion(null)}
        onConfirm={() => {
          void confirmDeletion();
        }}
        title={pendingDeletion?.title ?? 'Delete?'}
        visible={pendingDeletion !== null}
      />
    </ParentScreen>
  );
}

function NoResults({ search, suggestions, onClear }: { search?: string; suggestions: string[]; onClear(): void }) {
  return (
    <View style={styles.noResults}>
      <Text accessibilityRole="header" maxFontSizeMultiplier={1.5} style={styles.noResultsTitle}>
        {search ? `No toys called “${search}”` : 'No toys match these filters'}
      </Text>
      <Text style={styles.noResultsBody}>
        {search
          ? 'Search looks at toy names only. Try a room or a kind of play instead.'
          : 'Try a different combination, or clear the filters to see everything.'}
      </Text>
      {suggestions.length > 0 ? (
        <View style={styles.suggestionRow}>
          {suggestions.map((name) => <FilterChip key={name} label={name} onPress={onClear} />)}
        </View>
      ) : null}
      <SecondaryButton label="Clear filters" onPress={onClear} />
    </View>
  );
}

function FilterSheet({
  visible,
  onClose,
  filters,
  onChange,
  onApply,
  onReset,
  locations,
}: {
  visible: boolean;
  onClose(): void;
  filters: ToyFilters;
  onChange(value: ToyFilters): void;
  onApply(): void;
  onReset(): void;
  locations: LocationTreeItem[];
}) {
  const storageSpots = filters.roomId
    ? locations.find((room) => room.id === filters.roomId)?.storageSpots ?? []
    : locations.flatMap((room) => room.storageSpots);

  const chooseRoom = (roomId: number | null): void => {
    const spotStillMatches = !filters.storageSpotId || roomId === null
      || locations.find((room) => room.id === roomId)?.storageSpots.some((spot) => spot.id === filters.storageSpotId);
    onChange({ ...filters, roomId, storageSpotId: spotStillMatches ? filters.storageSpotId : null });
  };

  return (
    <Sheet onDismiss={onClose} subtitle="Everything here can be cleared in one tap." title="Filter toys" visible={visible}>
      <ScrollView contentContainerStyle={styles.sheetContent} keyboardShouldPersistTaps="handled" style={styles.sheetScroll}>
        <FilterGroup label="Room">
          <FilterChip label="All rooms" onPress={() => chooseRoom(null)} selected={!filters.roomId} />
          {locations.map((room) => (
            <FilterChip key={room.id} label={room.name} onPress={() => chooseRoom(room.id)} selected={filters.roomId === room.id} />
          ))}
        </FilterGroup>

        <FilterGroup label="Storage spot">
          <FilterChip label="All spots" onPress={() => onChange({ ...filters, storageSpotId: null })} selected={!filters.storageSpotId} />
          {storageSpots.map((spot) => (
            <FilterChip
              key={spot.id}
              label={spot.name}
              onPress={() => onChange({ ...filters, roomId: spot.roomId, storageSpotId: spot.id })}
              selected={filters.storageSpotId === spot.id}
            />
          ))}
        </FilterGroup>

        <FilterGroup label="Kind of play">
          <FilterChip label="Any" onPress={() => onChange({ ...filters, category: null })} selected={!filters.category} />
          {PLAY_CATEGORIES.map((category) => (
            <FilterChip
              key={category}
              label={labels[category]}
              onPress={() => onChange({ ...filters, category })}
              selected={filters.category === category}
            />
          ))}
        </FilterGroup>

        <FilterGroup label="Tidy-up size">
          <FilterChip label="Any" onPress={() => onChange({ ...filters, cleanupDifficulty: null })} selected={!filters.cleanupDifficulty} />
          {(['easy', 'medium', 'big'] as const).map((value) => (
            <FilterChip
              key={value}
              label={value === 'big' ? 'Big' : value === 'easy' ? 'Easy' : 'Medium'}
              onPress={() => onChange({ ...filters, cleanupDifficulty: value })}
              selected={filters.cleanupDifficulty === value}
            />
          ))}
        </FilterGroup>

        <FilterGroup label="Grown-up help">
          <FilterChip label="Any" onPress={() => onChange({ ...filters, adultHelpRequired: null })} selected={filters.adultHelpRequired == null} />
          <FilterChip label="Needed" onPress={() => onChange({ ...filters, adultHelpRequired: true })} selected={filters.adultHelpRequired === true} />
          <FilterChip label="Not needed" onPress={() => onChange({ ...filters, adultHelpRequired: false })} selected={filters.adultHelpRequired === false} />
        </FilterGroup>

        <FilterGroup label="Shown in Child Mode">
          {(['all', 'available', 'hidden'] as const).map((value) => (
            <FilterChip
              key={value}
              label={value === 'all' ? 'All' : value === 'available' ? 'Shown' : 'Hidden'}
              onPress={() => onChange({ ...filters, availability: value })}
              selected={filters.availability === value}
            />
          ))}
        </FilterGroup>

        <FilterGroup label="Library status">
          {(['active', 'archived', 'all'] as const).map((value) => (
            <FilterChip
              key={value}
              label={value === 'active' ? 'Active' : value === 'archived' ? 'Archived' : 'Both'}
              onPress={() => onChange({ ...filters, archived: value })}
              selected={filters.archived === value}
            />
          ))}
        </FilterGroup>
      </ScrollView>

      <View style={styles.sheetActions}>
        <SecondaryButton label="Clear all" onPress={onReset} style={styles.sheetButton} />
        <PrimaryButton label="Show toys" onPress={onApply} style={styles.sheetButton} />
      </View>
    </Sheet>
  );
}

function FilterGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={styles.filterGroup}>
      <Text style={styles.filterGroupLabel}>{label}</Text>
      <View style={styles.chips}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  pressed: { opacity: 0.72 },
  headerRow: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  title: { color: theme.colors.primaryText, ...theme.typography.pageTitle },
  selectAction: { justifyContent: 'center', minHeight: theme.measurements.minimumTouchTarget, paddingLeft: theme.spacing[12] },
  selectLabel: { color: theme.colors.brandInk, ...theme.typography.label },

  tools: { flexDirection: 'row', gap: theme.spacing[8] },
  searchWrap: { flex: 1 },
  filterButton: {
    alignItems: 'center',
    backgroundColor: theme.colors.cardSurface,
    borderColor: theme.colors.border,
    borderRadius: theme.radii.control,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 5,
    justifyContent: 'center',
    minHeight: theme.measurements.searchHeight,
    paddingHorizontal: theme.spacing[12],
  },
  filterButtonActive: { backgroundColor: theme.colors.selectedSurface, borderColor: theme.colors.brandInk, borderWidth: 2 },
  filterCount: { color: theme.colors.brandInk, ...theme.typography.label, fontSize: 14 },

  appliedRow: { alignItems: 'center', flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing[8] },
  clearButton: { minHeight: theme.measurements.minimumTouchTarget, paddingHorizontal: theme.spacing[8] },
  shown: { color: theme.colors.mutedText, marginLeft: 'auto', ...theme.typography.meta },

  grid: { flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: -theme.spacing[4] },
  cell: { padding: theme.spacing[4] },

  noResults: { alignItems: 'center', gap: theme.spacing[8], paddingVertical: theme.spacing[24] },
  noResultsTitle: { color: theme.colors.primaryText, textAlign: 'center', ...theme.typography.sectionTitle },
  noResultsBody: { color: theme.colors.secondaryText, textAlign: 'center', ...theme.typography.meta },
  suggestionRow: { flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing[8], justifyContent: 'center', marginVertical: theme.spacing[4] },

  sheetScroll: { maxHeight: 420 },
  sheetContent: { gap: theme.spacing[16], paddingBottom: theme.spacing[8] },
  filterGroup: { gap: 6 },
  filterGroupLabel: { color: theme.colors.primaryText, ...theme.typography.fieldLabel },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing[8] },
  sheetActions: { flexDirection: 'row', gap: theme.spacing[8] },
  sheetButton: { flex: 1 },

  bulkBar: { flexDirection: 'row', gap: theme.spacing[8] },
  bulkButton: { flex: 1 },
});
