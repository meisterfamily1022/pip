import { useCallback, useEffect, useState } from 'react';
import { router, useFocusEffect } from 'expo-router';
import {
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import { ToyPhoto } from '@/components/toy-photo';
import { initializeDatabase } from '@/database/client';
import {
  ArchiveIcon,
  CameraIcon,
  FilterIcon,
  HideIcon,
  PencilIcon,
  SearchIcon,
  ToyBoxEmptyIcon,
  TrashIcon,
  type IconProps,
} from '@/design/icons';
import {
  BackLink,
  Card,
  EmptyState,
  ErrorState,
  ErrorText,
  LoadingState,
  LocationLine,
  ModeBadge,
  PrimaryButton,
  Screen,
  ScreenTitle,
  SecondaryButton,
  SelectPill,
  Tag,
} from '@/design/primitives';
import { MIN_TOUCH_TARGET, colors, fontSizes, fonts, radii, spacing } from '@/design/tokens';
import { PLAY_CATEGORIES, playCategoryLabel, type PlayCategory } from '@/domain/play-category';
import { confirmLocationDeletion } from '@/features/locations/confirmation';
import {
  countLibraryToys,
  loadToyLibrary,
  removeToy,
  setToyArchivedState,
  setToyHidden,
  type ToyWithLocation,
} from '@/features/toys/toy-service';

/**
 * Toy Library — every toy the parent has photographed, in a photo grid.
 *
 * Search and category filters narrow the grid. Each card carries the four
 * things a grown-up does to a toy: edit it, hide it from Child Mode, archive
 * it, or delete it for good.
 */

/** How long the parent has to stop typing before the library re-queries SQLite. */
const SEARCH_DEBOUNCE_MS = 250;
/** Roughly one grid column per this many points of content width. */
const COLUMN_WIDTH = 220;
const GRID_GAP = spacing.xl;
/** Matches the centred column `Screen` lays out, so the grid maths agree with it. */
const MAX_CONTENT_WIDTH = 960;
const ACTION_ICON_SIZE = 18;

export default function ParentToyLibraryRoute() {
  const { width } = useWindowDimensions();
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [categories, setCategories] = useState<readonly PlayCategory[]>([]);
  const [toys, setToys] = useState<ToyWithLocation[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => setSearch(searchInput), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const reload = useCallback(async (): Promise<void> => {
    try {
      const database = await initializeDatabase();
      const [list, count] = await Promise.all([
        loadToyLibrary(database, { search, categories }),
        countLibraryToys(database),
      ]);
      setToys(list);
      setTotal(count);
      setError(null);
    } catch (caught: unknown) {
      setError(caught instanceof Error ? caught.message : 'Could not load your toy library.');
    } finally {
      setLoading(false);
    }
  }, [categories, search]);

  useFocusEffect(
    useCallback(() => {
      void reload();
    }, [reload]),
  );

  const toggleCategory = (category: PlayCategory): void => {
    setCategories((current) =>
      current.includes(category) ? current.filter((item) => item !== category) : [...current, category],
    );
  };

  const clearFilters = (): void => {
    setSearchInput('');
    setSearch('');
    setCategories([]);
  };

  const runAction = async (action: () => Promise<unknown>, failure: string): Promise<void> => {
    try {
      await action();
      await reload();
    } catch (caught: unknown) {
      setError(caught instanceof Error ? caught.message : failure);
    }
  };

  const toggleHidden = (toy: ToyWithLocation): void => {
    void runAction(async () => {
      const database = await initializeDatabase();
      await setToyHidden(database, toy.id, toy.isAvailable);
    }, `Could not update ${toy.name}.`);
  };

  const archive = (toy: ToyWithLocation): void => {
    void (async () => {
      const confirmed = await confirmLocationDeletion(
        'Archive toy?',
        `Archive ${toy.name}? It leaves the library and stops being suggested, but stays saved.`,
      );
      if (!confirmed) return;
      await runAction(async () => {
        const database = await initializeDatabase();
        await setToyArchivedState(database, toy.id, true);
      }, `Could not archive ${toy.name}.`);
    })();
  };

  const remove = (toy: ToyWithLocation): void => {
    void (async () => {
      const confirmed = await confirmLocationDeletion(
        'Delete toy?',
        `Delete ${toy.name}? This also removes its photo and play history.`,
      );
      if (!confirmed) return;
      await runAction(async () => {
        const database = await initializeDatabase();
        await removeToy(database, toy.id);
      }, `Could not delete ${toy.name}.`);
    })();
  };

  const contentWidth = Math.min(width, MAX_CONTENT_WIDTH) - spacing.xxl * 2;
  const columns = Math.min(4, Math.max(2, Math.floor(contentWidth / COLUMN_WIDTH)));
  const cardWidth = (contentWidth - GRID_GAP * (columns - 1)) / columns;
  const filtered = search.trim().length > 0 || categories.length > 0;

  return (
    <Screen mode="parent">
      <BackLink
        label="Home"
        onPress={() => {
          if (router.canGoBack()) router.back();
          else router.replace('/parent/home');
        }}
      />
      <View style={styles.header}>
        <ModeBadge mode="parent" />
        <ScreenTitle>Toy Library</ScreenTitle>
        <Text accessibilityLiveRegion="polite" style={styles.count}>
          {`${toys.length} of ${total} toys showing`}
        </Text>
        <PrimaryButton
          icon={CameraIcon}
          label="Add Toys"
          onPress={() => router.push('/parent/add-toy')}
          style={styles.addButton}
        />
      </View>

      <View style={styles.controls}>
        <View style={styles.searchField}>
          <SearchIcon size={18} color={colors.textSecondary} />
          <TextInput
            accessibilityLabel="Search toys by name"
            autoCorrect={false}
            onChangeText={setSearchInput}
            placeholder="Search toys"
            placeholderTextColor={colors.textSecondary}
            returnKeyType="search"
            style={styles.searchInput}
            value={searchInput}
          />
        </View>
        <Pressable
          accessibilityLabel="Filters"
          accessibilityRole="button"
          accessibilityState={{ expanded: filtersOpen }}
          onPress={() => setFiltersOpen((open) => !open)}
          style={({ pressed }) => [
            styles.filterButton,
            filtersOpen && styles.filterButtonOpen,
            pressed && styles.pressed,
          ]}
        >
          <FilterIcon size={17} color={colors.green} />
          <Text style={styles.filterButtonText}>Filters</Text>
        </Pressable>
      </View>

      {filtersOpen ? (
        <View style={styles.filterPills}>
          {PLAY_CATEGORIES.map((category) => (
            <SelectPill
              key={category}
              label={playCategoryLabel(category)}
              onPress={() => toggleCategory(category)}
              role="checkbox"
              selected={categories.includes(category)}
            />
          ))}
        </View>
      ) : null}

      {error && toys.length > 0 ? <ErrorText>{error}</ErrorText> : null}

      {loading ? (
        <View style={styles.stateBlock}>
          <LoadingState label="Loading your toys…" />
        </View>
      ) : error && toys.length === 0 ? (
        <View style={styles.stateBlock}>
          <ErrorState
            message={error}
            onRetry={() => {
              void reload();
            }}
          />
        </View>
      ) : toys.length === 0 ? (
        <EmptyState
          action={
            filtered ? (
              <SecondaryButton label="Clear filters" onPress={clearFilters} />
            ) : (
              <PrimaryButton icon={CameraIcon} label="Add Toys" onPress={() => router.push('/parent/add-toy')} />
            )
          }
          description={
            filtered
              ? 'No toy matches that search or those categories. Try a different word, or clear the filters.'
              : 'Photograph a toy, say where it belongs, and your child can start finding it — and putting it back.'
          }
          icon={ToyBoxEmptyIcon}
          title={filtered ? 'Nothing matched' : 'No toys yet'}
        />
      ) : (
        <View style={styles.grid}>
          {toys.map((toy) => (
            <ToyCard
              key={toy.id}
              onArchive={() => archive(toy)}
              onDelete={() => remove(toy)}
              onEdit={() => router.push(`/parent/edit-toy?id=${toy.id}`)}
              onToggleHidden={() => toggleHidden(toy)}
              toy={toy}
              width={cardWidth}
            />
          ))}
        </View>
      )}
    </Screen>
  );
}

type ToyActionProps = {
  icon: (props: IconProps) => React.JSX.Element;
  label: string;
  onPress(): void;
  color?: string;
  style?: StyleProp<ViewStyle>;
};

/** Icon-only card action. The 18pt glyph is padded out to a 44pt touch target. */
const ToyAction = ({ icon: IconComponent, label, onPress, color = colors.textSecondary, style }: ToyActionProps) => (
  <Pressable
    accessibilityLabel={label}
    accessibilityRole="button"
    hitSlop={(MIN_TOUCH_TARGET - ACTION_ICON_SIZE) / 2}
    onPress={onPress}
    style={({ pressed }) => [style, pressed && styles.pressed]}
  >
    <IconComponent size={ACTION_ICON_SIZE} color={color} />
  </Pressable>
);

type ToyCardProps = {
  toy: ToyWithLocation;
  width: number;
  onEdit(): void;
  onToggleHidden(): void;
  onArchive(): void;
  onDelete(): void;
};

const ToyCard = ({ toy, width, onEdit, onToggleHidden, onArchive, onDelete }: ToyCardProps) => {
  const hidden = !toy.isAvailable;
  return (
    <Card style={[styles.toyCard, { width }, hidden && styles.toyCardHidden]}>
      <ToyPhoto label={toy.name} style={styles.toyPhoto} uri={toy.imageUri} />
      <View style={styles.toyBody}>
        <Text style={styles.toyName}>{toy.name}</Text>
        <LocationLine label={`${toy.roomName} → ${toy.storageSpotName}`} size="small" />
        {hidden ? <Text style={styles.hiddenNote}>Hidden from Child Mode</Text> : null}
        {toy.categories.length > 0 ? (
          <View style={styles.toyTags}>
            {toy.categories.map((category) => (
              <Tag key={category} label={playCategoryLabel(category)} />
            ))}
          </View>
        ) : null}
        <View style={styles.toyActions}>
          <ToyAction icon={PencilIcon} label={`Edit ${toy.name}`} onPress={onEdit} />
          <ToyAction
            icon={HideIcon}
            label={hidden ? `Show ${toy.name}` : `Hide ${toy.name}`}
            onPress={onToggleHidden}
          />
          <ToyAction icon={ArchiveIcon} label={`Archive ${toy.name}`} onPress={onArchive} />
          <ToyAction
            color={colors.danger}
            icon={TrashIcon}
            label={`Delete ${toy.name}`}
            onPress={onDelete}
            style={styles.deleteAction}
          />
        </View>
      </View>
    </Card>
  );
};

const styles = StyleSheet.create({
  addButton: { alignSelf: 'flex-start', marginTop: spacing.sm },
  controls: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md, marginBottom: spacing.md },
  count: { color: colors.textSecondary, fontSize: fontSizes.bodySmall, lineHeight: 22 },
  deleteAction: { marginLeft: 'auto' },
  filterButton: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.green,
    borderRadius: radii.action,
    borderWidth: 1.5,
    flexDirection: 'row',
    gap: spacing.sm,
    justifyContent: 'center',
    minHeight: 52,
    paddingHorizontal: spacing.xl,
  },
  filterButtonOpen: { backgroundColor: colors.mint },
  filterButtonText: { color: colors.green, fontSize: fontSizes.bodySmall, fontWeight: '700' },
  filterPills: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.md },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: GRID_GAP },
  header: { gap: spacing.sm, marginBottom: spacing.xl, marginTop: spacing.md },
  hiddenNote: { color: colors.terracotta, fontSize: fontSizes.caption, fontWeight: '700' },
  pressed: { opacity: 0.6 },
  searchField: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radii.action,
    borderWidth: 1,
    flexBasis: 220,
    flexDirection: 'row',
    flexGrow: 1,
    gap: spacing.md,
    minHeight: 52,
    paddingHorizontal: spacing.lg,
  },
  searchInput: { color: colors.textPrimary, flex: 1, fontSize: fontSizes.body, paddingVertical: spacing.md },
  stateBlock: { minHeight: 200 },
  toyActions: {
    alignItems: 'center',
    borderTopColor: colors.border,
    borderTopWidth: 1,
    flexDirection: 'row',
    gap: spacing.lg,
    marginTop: spacing.xs,
    paddingTop: spacing.md,
  },
  toyBody: { gap: 6, padding: spacing.lg },
  toyCard: { padding: 0 },
  toyCardHidden: { opacity: 0.55 },
  toyName: { color: colors.textPrimary, fontFamily: fonts.heading, fontSize: fontSizes.bodyLarge, fontWeight: '700' },
  toyPhoto: { borderTopLeftRadius: radii.card, borderTopRightRadius: radii.card },
  toyTags: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: spacing.xs },
});
