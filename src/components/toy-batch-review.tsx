import { useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { initializeDatabase } from '@/database/client';
import type { ToySetupDraft } from '@/domain/models';
import { PLAY_CATEGORIES, type PlayCategory } from '@/domain/play-category';
import type { LocationTreeItem } from '@/features/locations/location-service';
import {
  draftCategories,
  intakeDraftErrors,
  summarizeIntakeQueue,
  type IntakeDraftPatch,
} from '@/features/toys/toy-intake-queue';
import { findDuplicateToyByName } from '@/features/toys/toy-service';
import { playmapTheme as theme } from '@/theme/playmap-theme';

import {
  Banner,
  FilterChip,
  ImageTile,
  PrimaryButton,
  RoundedSelect,
  RoundedTextInput,
  SecondaryButton,
  Sheet,
  ListCard,
  ListRow,
  StickyFooter,
  ToggleRow,
  ToyImage,
} from './playmap-ui';

const categoryLabels: Record<PlayCategory, string> = {
  quiet: 'Quiet', active: 'Active', creative: 'Make', building: 'Build', pretend: 'Pretend',
  sensory: 'Touch & feel', independent: 'Alone', together: 'Together', indoor: 'Indoor', outdoor: 'Outdoor',
};

/**
 * Batch review, one photo at a time.
 *
 * A parent cataloguing a shelf is doing the same three things over and over, so
 * the screen shows one photo and asks only what changes: what is it, and where
 * does it live. Room, spot and kind of play carry forward from the previous
 * record, because the next toy is almost always on the same shelf.
 *
 * Nothing is lost by leaving: every keystroke is written to the draft table, so
 * "Save & finish later" is a real exit and a crash is not a setback.
 */
export function ToyBatchReview({
  drafts, locations, saving, onAddMore, onCaptureMore, onSaveAll, onUpdate, onReplace, onRemove, onFinishLater,
}: {
  drafts: readonly ToySetupDraft[];
  locations: LocationTreeItem[];
  saving: boolean;
  onAddMore(): void;
  onCaptureMore(): void;
  onSaveAll(): void;
  onUpdate(draft: ToySetupDraft, patch: IntakeDraftPatch): Promise<void>;
  onReplace(draft: ToySetupDraft): void;
  onRemove(draft: ToySetupDraft): Promise<void>;
  onFinishLater?(): void;
}) {
  const pending = useMemo(() => drafts.filter((draft) => draft.savedToyId === null), [drafts]);
  const summary = summarizeIntakeQueue(drafts);
  const [index, setIndex] = useState(0);
  const [locationSheet, setLocationSheet] = useState<'room' | 'spot' | null>(null);

  // Removing or saving the last record must not strand the cursor past the end,
  // so the cursor is clamped where it is read rather than corrected afterwards.
  const cursor = Math.min(index, Math.max(pending.length - 1, 0));
  const current = pending[cursor];
  const saved = drafts.filter((draft) => draft.savedToyId !== null);
  const failed = drafts.filter((draft) => draft.savedToyId === null && draft.saveError);

  if (pending.length === 0) {
    return (
      <BatchComplete
        failed={failed}
        onAddMore={onAddMore}
        onRemove={onRemove}
        onRetry={onSaveAll}
        saved={saved}
        saving={saving}
      />
    );
  }

  return (
    <View style={styles.stepper}>
      <View style={styles.progressRow}>
        {onFinishLater ? (
          <SecondaryButton label="Save &amp; finish later" onPress={onFinishLater} style={styles.finishLater} />
        ) : <View />}
        <Text style={styles.counter}>{`${cursor + 1} of ${pending.length}`}</Text>
      </View>
      <View accessibilityLabel={`Photo ${cursor + 1} of ${pending.length}`} accessibilityRole="progressbar" style={styles.progressTrack}>
        <View style={[styles.progressFill, { width: `${((cursor + 1) / pending.length) * 100}%` }]} />
      </View>

      {current ? (
        <DraftEditor
          drafts={drafts}
          key={current.id}
          draft={current}
          locations={locations}
          onOpenLocation={setLocationSheet}
          onRemove={onRemove}
          onReplace={onReplace}
          onUpdate={onUpdate}
          saving={saving}
        />
      ) : null}

      {summary.failed > 0 ? (
        <Banner message={`${summary.failed} photo${summary.failed === 1 ? '' : 's'} failed to save last time. Nothing else was affected.`} tone="alert" />
      ) : null}

      <StickyFooter>
        <View style={styles.footerRow}>
          <SecondaryButton
            disabled={saving || cursor >= pending.length - 1}
            label="Skip"
            onPress={() => setIndex(Math.min(cursor + 1, pending.length - 1))}
            style={styles.skip}
          />
          <PrimaryButton
            busy={saving}
            disabled={!current || intakeDraftErrors(current).length > 0}
            label={pending.length === 1 ? 'Save this toy' : 'Save &amp; next photo'}
            onPress={onSaveAll}
            style={styles.saveNext}
          />
        </View>
      </StickyFooter>

      <LocationSheet
        draft={current}
        kind={locationSheet}
        locations={locations}
        onClose={() => setLocationSheet(null)}
        onUpdate={onUpdate}
      />
    </View>
  );
}

function DraftEditor({
  draft, drafts, locations, saving, onUpdate, onReplace, onRemove, onOpenLocation,
}: {
  draft: ToySetupDraft;
  drafts: readonly ToySetupDraft[];
  locations: LocationTreeItem[];
  saving: boolean;
  onUpdate(draft: ToySetupDraft, patch: IntakeDraftPatch): Promise<void>;
  onReplace(draft: ToySetupDraft): void;
  onRemove(draft: ToySetupDraft): Promise<void>;
  onOpenLocation(kind: 'room' | 'spot'): void;
}) {
  const [name, setName] = useState(draft.draftName ?? '');
  const [duplicate, setDuplicate] = useState<{ name: string; where: string } | null>(null);
  const categories = draftCategories(draft);
  const room = locations.find((candidate) => candidate.id === draft.roomId);
  const spot = room?.storageSpots.find((candidate) => candidate.id === draft.storageSpotId);
  const errors = intakeDraftErrors(draft);

  // Warn about an existing toy of the same name, once typing has settled.
  useEffect(() => {
    let active = true;
    const trimmed = name.trim();
    const timer = setTimeout(() => {
      void (async () => {
        if (trimmed.length < 2) {
          if (active) setDuplicate(null);
          return;
        }
        try {
          const database = await initializeDatabase();
          const existing = await findDuplicateToyByName(database, trimmed);
          if (active) setDuplicate(existing ? { name: existing.name, where: `${existing.roomName} · ${existing.storageSpotName}` } : null);
        } catch {
          // A duplicate check that fails is not worth interrupting intake for.
        }
      })();
    }, 400);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [name]);

  const persist = (patch: IntakeDraftPatch): void => {
    void onUpdate(draft, patch);
  };

  const toggleCategory = (category: PlayCategory): void => {
    // Kinds of play apply to the whole batch: a shelf of blocks is a shelf of
    // blocks, and re-picking it for every photo is the tedium this replaces.
    const next = categories.includes(category) ? categories.filter((item) => item !== category) : [...categories, category];
    for (const candidate of drafts) {
      if (candidate.savedToyId === null) void onUpdate(candidate, { categories: next });
    }
  };

  return (
    <View style={styles.editor}>
      <View style={styles.photoFrame}>
        <ToyImage accessibilityLabel="Photo being reviewed" style={styles.photo} uri={draft.originalImageUri} />
        <View style={styles.photoActions}>
          <PhotoAction disabled={saving} label="Replace" onPress={() => onReplace(draft)} />
          <PhotoAction disabled={saving} label="Remove" onPress={() => { void onRemove(draft); }} />
        </View>
      </View>

      <RoundedTextInput
        accessibilityLabel="What is this toy?"
        editable={!saving}
        label="What is this?"
        onChangeText={(value) => {
          setName(value);
          persist({ name: value });
        }}
        placeholder="Marble run"
        returnKeyType="done"
        value={name}
      />

      {duplicate ? (
        <Banner
          message={`You already have a “${duplicate.name}” in ${duplicate.where}. Adding this one keeps both.`}
          tone="alert"
        />
      ) : null}

      {draft.saveError ? <Banner message={draft.saveError} title="This one didn’t save" tone="alert" /> : null}

      <View style={styles.locationRow}>
        <View style={styles.locationField}>
          <RoundedSelect label="Room" onPress={() => onOpenLocation('room')} value={room?.name} />
        </View>
        <View style={styles.locationField}>
          <RoundedSelect label="Spot" onPress={() => onOpenLocation('spot')} value={spot?.name} />
        </View>
      </View>

      <View style={styles.field}>
        <Text style={styles.fieldLabel}>Kind of play — applies to the whole batch</Text>
        <View style={styles.chips}>
          {PLAY_CATEGORIES.map((category) => (
            <FilterChip
              disabled={saving}
              key={category}
              label={categoryLabels[category]}
              onPress={() => toggleCategory(category)}
              selected={categories.includes(category)}
            />
          ))}
        </View>
      </View>

      <ToggleRow
        description="Mark toys that need a grown-up nearby."
        disabled={saving}
        label="Grown-up help needed"
        onValueChange={(value) => persist({ adultHelpRequired: value })}
        value={draft.adultHelpRequiredDraft ?? false}
      />
      <ToggleRow
        description="Offer this toy as a choice in Child Mode."
        disabled={saving}
        label="Shown in Child Mode"
        onValueChange={(value) => persist({ isAvailable: value })}
        value={draft.isAvailableDraft}
      />

      {errors.length > 0 ? <Text accessibilityLiveRegion="polite" style={styles.errors}>{errors.join(' ')}</Text> : null}
    </View>
  );
}

function PhotoAction({ label, onPress, disabled }: { label: string; onPress(): void; disabled: boolean }) {
  return (
    <SecondaryButton disabled={disabled} label={label} onPress={onPress} style={styles.photoAction} />
  );
}

function LocationSheet({
  kind, draft, locations, onClose, onUpdate,
}: {
  kind: 'room' | 'spot' | null;
  draft?: ToySetupDraft;
  locations: LocationTreeItem[];
  onClose(): void;
  onUpdate(draft: ToySetupDraft, patch: IntakeDraftPatch): Promise<void>;
}) {
  if (!draft) return null;
  const room = locations.find((candidate) => candidate.id === draft.roomId);
  const options = kind === 'room'
    ? locations.map((candidate) => ({ id: candidate.id, label: candidate.name, selected: candidate.id === draft.roomId }))
    : (room?.storageSpots ?? []).map((candidate) => ({ id: candidate.id, label: candidate.name, selected: candidate.id === draft.storageSpotId }));

  return (
    <Sheet
      onDismiss={onClose}
      subtitle={kind === 'spot' && !room ? 'Choose a room first.' : undefined}
      title={kind === 'room' ? 'Which room?' : 'Which spot?'}
      visible={kind !== null}
    >
      <ListCard>
        {options.map((option) => (
          <ListRow
            accessory={option.selected ? 'check' : 'none'}
            key={option.id}
            onPress={() => {
              void onUpdate(draft, kind === 'room' ? { roomId: option.id, storageSpotId: null } : { storageSpotId: option.id });
              onClose();
            }}
            title={option.label}
          />
        ))}
      </ListCard>
      <SecondaryButton label="Cancel" onPress={onClose} />
    </Sheet>
  );
}

/** The end of a batch: what landed, what did not, and the two ways on. */
function BatchComplete({
  saved, failed, saving, onAddMore, onRetry, onRemove,
}: {
  saved: readonly ToySetupDraft[];
  failed: readonly ToySetupDraft[];
  saving: boolean;
  onAddMore(): void;
  onRetry(): void;
  onRemove(draft: ToySetupDraft): Promise<void>;
}) {
  if (saved.length === 0 && failed.length === 0) return null;
  return (
    <View style={styles.complete}>
      <Text accessibilityRole="header" style={styles.completeTitle}>
        {`${saved.length} ${saved.length === 1 ? 'toy' : 'toys'} added`}
      </Text>
      {failed.length > 0 ? (
        <Text style={styles.completeBody}>
          {`${failed.length} photo${failed.length === 1 ? '' : 's'} couldn’t be saved. Nothing else was affected — retry now or later.`}
        </Text>
      ) : (
        <Text style={styles.completeBody}>Every photo in this batch is now a toy in your library.</Text>
      )}

      {failed.map((draft) => (
        <Banner
          action={<SecondaryButton disabled={saving} label="Retry" onPress={onRetry} />}
          key={draft.id}
          message={draft.saveError ?? 'This photo could not be saved.'}
          title={draft.draftName ?? 'Untitled photo'}
          tone="alert"
        />
      ))}

      {saved.length > 0 ? (
        <View style={styles.savedGrid}>
          {saved.map((draft) => (
            <View key={draft.id} style={styles.savedTile}>
              <ImageTile label={draft.draftName ?? 'Saved toy'} size={74} uri={draft.originalImageUri} />
              <Text numberOfLines={1} style={styles.savedName}>{draft.draftName ?? 'Untitled'}</Text>
            </View>
          ))}
        </View>
      ) : null}

      <PrimaryButton label="Photograph another shelf" onPress={onAddMore} />
      {saved.length > 0 ? (
        <SecondaryButton
          label="Clear this batch"
          onPress={() => {
            for (const draft of saved) void onRemove(draft);
          }}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  stepper: { gap: theme.spacing[12] },
  progressRow: { alignItems: 'center', flexDirection: 'row', gap: theme.spacing[12], justifyContent: 'space-between' },
  finishLater: { flexShrink: 1, minHeight: theme.measurements.minimumTouchTarget, paddingHorizontal: theme.spacing[12] },
  counter: { color: theme.colors.secondaryText, ...theme.typography.label, fontSize: 14 },
  progressTrack: { backgroundColor: theme.colors.neutralSurface, borderRadius: theme.radii.pill, height: 5, overflow: 'hidden' },
  progressFill: { backgroundColor: theme.colors.brandPrimary, height: '100%' },

  editor: { gap: theme.spacing[12] },
  photoFrame: { borderRadius: theme.radii.card, overflow: 'hidden' },
  photo: { aspectRatio: 4 / 3, width: '100%' },
  photoActions: { bottom: theme.spacing[8], flexDirection: 'row', gap: theme.spacing[8], position: 'absolute', right: theme.spacing[8] },
  photoAction: {
    backgroundColor: 'rgba(255, 255, 255, 0.94)',
    minHeight: theme.measurements.minimumTouchTarget,
    paddingHorizontal: theme.spacing[12],
  },

  locationRow: { flexDirection: 'row', gap: theme.spacing[8] },
  locationField: { flex: 1 },
  field: { gap: 6 },
  fieldLabel: { color: theme.colors.primaryText, ...theme.typography.fieldLabel },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing[8] },
  errors: { color: theme.colors.error, ...theme.typography.meta },

  footerRow: { flexDirection: 'row', gap: theme.spacing[8] },
  skip: { paddingHorizontal: theme.spacing[20] },
  saveNext: { flex: 1 },

  complete: { gap: theme.spacing[12] },
  completeTitle: { color: theme.colors.primaryText, ...theme.typography.pageTitle },
  completeBody: { color: theme.colors.secondaryText, ...theme.typography.body },
  savedGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing[12] },
  savedTile: { alignItems: 'center', gap: 4, width: 74 },
  savedName: { color: theme.colors.secondaryText, textAlign: 'center', ...theme.typography.caption },
});
